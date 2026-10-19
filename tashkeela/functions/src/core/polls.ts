// Polls an organizer makes and manages by hand: their own date, time, place
// and squad size, next to (or instead of) the weekly poll.

import { Firestore, Timestamp } from "firebase-admin/firestore";
import { DAY, MINUTE } from "../domain/time";
import { GameDoc, GroupDoc } from "../model";
import { Notice } from "../notify/notices";
import { AppError, invalid } from "./errors";
import { ACTIVE_STATUSES, gameRef, groupRef, newGame, refreshCurrentGame } from "./games";
import { loadGroup, requireAdmin } from "./groups";
import { applyRosterAction } from "./roster-ops";

export interface PollFields {
  kickoffAt?: unknown;
  durationMinutes?: unknown;
  venue?: unknown;
  squadSize?: unknown;
  /** When voting opens; null or missing means right away. */
  pollOpensAt?: unknown;
}

const millis = (v: unknown, field: string): number => {
  if (typeof v !== "number" || !Number.isFinite(v)) throw invalid(`${field} must be a time`);
  return v;
};
const intIn = (v: unknown, field: string, lo: number, hi: number): number => {
  if (!Number.isInteger(v) || (v as number) < lo || (v as number) > hi) throw invalid(`${field} must be between ${lo} and ${hi}`);
  return v as number;
};
const place = (v: unknown): string => {
  if (typeof v !== "string" || !v.trim() || v.trim().length > 80) throw invalid("location is required (up to 80 characters)");
  return v.trim();
};

export async function createPoll(
  db: Firestore,
  input: PollFields & { groupId: string; uid: string; now: number },
): Promise<{ gameId: string }> {
  const group = await loadGroup(db, input.groupId);
  requireAdmin(group, input.uid);
  const kickoffAt = millis(input.kickoffAt, "kickoffAt");
  if (kickoffAt <= input.now) throw invalid("the game must be in the future");
  if (kickoffAt > input.now + 120 * DAY) throw invalid("the game must be within four months");
  const opens = input.pollOpensAt === undefined || input.pollOpensAt === null ? input.now : millis(input.pollOpensAt, "pollOpensAt");
  if (opens >= kickoffAt) throw invalid("voting must open before the game");
  const durationMinutes =
    input.durationMinutes === undefined ? group.schedule.matchDurationMinutes : intIn(input.durationMinutes, "durationMinutes", 30, 300);
  const squadSize = input.squadSize === undefined ? group.rules.squadSize : intIn(input.squadSize, "squadSize", 2, 60);
  const venue = input.venue === undefined ? group.venue : place(input.venue);

  const ref = groupRef(db, input.groupId).collection("games").doc();
  await db.runTransaction(async (tx) => {
    const g = (await tx.get(groupRef(db, input.groupId))).data() as GroupDoc;
    const weekNumber = g.weekCounter + 1;
    tx.set(
      ref,
      newGame({
        kind: "custom",
        weekNumber,
        kickoffAt,
        durationMinutes,
        venue,
        pollOpensAt: Math.max(opens, input.now - MINUTE),
        squadSize,
        createdBy: input.uid,
        now: input.now,
      }),
    );
    tx.update(groupRef(db, input.groupId), { weekCounter: weekNumber, updatedAt: Timestamp.fromMillis(input.now) });
  });
  await refreshCurrentGame(db, input.groupId, input.now);
  return { gameId: ref.id };
}

/**
 * Change a poll that hasn't been played yet. Moving it or changing the place
 * tells everyone on its list; a new squad size re-sorts the list.
 */
export async function updatePoll(
  db: Firestore,
  input: PollFields & { groupId: string; uid: string; gameId: string; now: number },
): Promise<Notice[]> {
  const group = await loadGroup(db, input.groupId);
  requireAdmin(group, input.uid);
  const ref = gameRef(db, input.groupId, input.gameId);

  const { moved, resized } = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("not_found", "poll not found");
    const game = snap.data() as GameDoc;
    if (!ACTIVE_STATUSES.includes(game.status)) throw invalid("only a poll that hasn't been played can change");

    const changes: Partial<GameDoc> = {};
    const kickoffAt = input.kickoffAt === undefined ? game.kickoffAt.toMillis() : millis(input.kickoffAt, "kickoffAt");
    if (kickoffAt !== game.kickoffAt.toMillis()) {
      if (kickoffAt <= input.now) throw invalid("the game must be in the future");
      changes.kickoffAt = Timestamp.fromMillis(kickoffAt);
      // A new day means a new match-day reminder.
      changes.matchDayReminderSent = false;
    }
    if (input.pollOpensAt !== undefined && game.status === "scheduled") {
      const opens = input.pollOpensAt === null ? input.now : millis(input.pollOpensAt, "pollOpensAt");
      changes.pollOpensAt = Timestamp.fromMillis(Math.max(opens, input.now - MINUTE));
    }
    const opens = (changes.pollOpensAt ?? game.pollOpensAt).toMillis();
    if (opens >= kickoffAt) throw invalid("voting must open before the game");
    if (input.durationMinutes !== undefined) changes.durationMinutes = intIn(input.durationMinutes, "durationMinutes", 30, 300);
    if (input.venue !== undefined) {
      const venue = place(input.venue);
      if (venue !== game.venue) changes.venue = venue;
    }
    if (input.squadSize !== undefined) {
      const size = intIn(input.squadSize, "squadSize", 2, 60);
      if (size !== game.squadSize) changes.squadSize = size;
    }
    if (Object.keys(changes).length) tx.update(ref, { ...changes, updatedAt: Timestamp.fromMillis(input.now) });
    return {
      moved: game.status === "open" && (changes.kickoffAt !== undefined || changes.venue !== undefined),
      resized: game.status === "open" && changes.squadSize !== undefined,
    };
  });

  const notices: Notice[] = [];
  if (resized) {
    const r = await applyRosterAction(db, {
      groupId: input.groupId,
      gameId: input.gameId,
      memberId: null,
      action: "expire",
      source: "admin",
      actorUid: input.uid,
      now: input.now,
    });
    notices.push(...r.notices);
  }
  if (moved) notices.push({ kind: "poll_changed", groupId: input.groupId, gameId: input.gameId });
  await refreshCurrentGame(db, input.groupId, input.now);
  return notices;
}

/** Call a game off. Everyone on its list hears about it; the list is kept for the record. */
export async function cancelPoll(
  db: Firestore,
  input: { groupId: string; uid: string; gameId: string; now: number },
): Promise<Notice[]> {
  const group = await loadGroup(db, input.groupId);
  requireAdmin(group, input.uid);
  const ref = gameRef(db, input.groupId, input.gameId);
  const wasOpen = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("not_found", "poll not found");
    const game = snap.data() as GameDoc;
    if (game.status === "played" || game.status === "cancelled") throw invalid("this game is already over");
    tx.update(ref, { status: "cancelled", nextOfferExpiry: null, updatedAt: Timestamp.fromMillis(input.now) });
    return game.status === "open";
  });
  await refreshCurrentGame(db, input.groupId, input.now);
  return wasOpen ? [{ kind: "poll_cancelled", groupId: input.groupId, gameId: input.gameId }] : [];
}
