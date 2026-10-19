import { Firestore, Timestamp } from "firebase-admin/firestore";
import { DAY } from "../domain/time";
import { currentKickoff, gameIdFor, pollOpensAt } from "../domain/schedule";
import { GameDoc, GameKind, GameStatus, GroupDoc } from "../model";
import { AppError } from "./errors";

export const groupRef = (db: Firestore, groupId: string) => db.collection("groups").doc(groupId);
export const gameRef = (db: Firestore, groupId: string, gameId: string) =>
  groupRef(db, groupId).collection("games").doc(gameId);

/** Polls that are still ahead: not yet open, or open for votes. */
export const ACTIVE_STATUSES: GameStatus[] = ["scheduled", "open"];

/** A new poll's document. */
export function newGame(input: {
  kind: GameKind;
  weekNumber: number;
  kickoffAt: number;
  durationMinutes: number;
  venue: string;
  pollOpensAt: number;
  squadSize: number;
  createdBy: string | null;
  now: number;
}): GameDoc {
  const stamp = Timestamp.fromMillis(input.now);
  return {
    kind: input.kind,
    weekNumber: input.weekNumber,
    kickoffAt: Timestamp.fromMillis(input.kickoffAt),
    durationMinutes: input.durationMinutes,
    venue: input.venue,
    pollOpensAt: Timestamp.fromMillis(input.pollOpensAt),
    status: input.now >= input.pollOpensAt ? "open" : "scheduled",
    nextSeq: 1,
    squadSize: input.squadSize,
    squadCount: 0,
    reserveCount: 0,
    nextOfferExpiry: null,
    pollOpenNotified: false,
    matchDayReminderSent: false,
    result: null,
    teams: null,
    createdBy: input.createdBy,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

/**
 * Make sure this week's poll exists, creating it from the group's weekly
 * schedule if needed. Does nothing when the weekly poll is turned off.
 */
export async function ensureWeeklyGame(
  db: Firestore,
  groupId: string,
  now: number,
): Promise<{ gameId: string | null; created: boolean }> {
  return db.runTransaction(async (tx) => {
    const gSnap = await tx.get(groupRef(db, groupId));
    if (!gSnap.exists) throw new AppError("not_found", "group not found");
    const group = gSnap.data() as GroupDoc;
    if (group.schedule.enabled === false) return { gameId: null, created: false };
    const kickoff = currentKickoff(now, group.schedule);
    const gameId = gameIdFor(kickoff, group.schedule.timeZone);
    const ref = gameRef(db, groupId, gameId);
    if ((await tx.get(ref)).exists) return { gameId, created: false };

    const weekNumber = group.weekCounter + 1;
    tx.set(
      ref,
      newGame({
        kind: "weekly",
        weekNumber,
        kickoffAt: kickoff,
        durationMinutes: group.schedule.matchDurationMinutes,
        venue: group.venue,
        pollOpensAt: pollOpensAt(kickoff, group.schedule),
        squadSize: group.rules.squadSize,
        createdBy: null,
        now,
      }),
    );
    tx.update(gSnap.ref, { weekCounter: weekNumber, updatedAt: Timestamp.fromMillis(now) });
    return { gameId, created: true };
  });
}

interface GameSummary {
  id: string;
  status: GameStatus;
  kickoffAt: number;
}

/**
 * The poll the app opens on: the next one still ahead, or else the latest
 * one played (so its result can be recorded and seen).
 */
export function pickCurrentGame(games: GameSummary[]): string | null {
  const ahead = games.filter((g) => ACTIVE_STATUSES.includes(g.status)).sort((a, b) => a.kickoffAt - b.kickoffAt);
  if (ahead.length) return ahead[0].id;
  const past = games.filter((g) => g.status === "closed" || g.status === "played").sort((a, b) => b.kickoffAt - a.kickoffAt);
  return past[0]?.id ?? null;
}

/** Point the group at the poll the app should open on. */
export async function refreshCurrentGame(db: Firestore, groupId: string, now: number): Promise<string | null> {
  const recent = await groupRef(db, groupId)
    .collection("games")
    .where("kickoffAt", ">=", Timestamp.fromMillis(now - 14 * DAY))
    .get();
  const gameId = pickCurrentGame(
    recent.docs.map((d) => {
      const g = d.data() as GameDoc;
      return { id: d.id, status: g.status, kickoffAt: g.kickoffAt.toMillis() };
    }),
  );
  const ref = groupRef(db, groupId);
  const group = (await ref.get()).data() as GroupDoc | undefined;
  if (group && group.currentGameId !== gameId) {
    await ref.update({ currentGameId: gameId, updatedAt: Timestamp.fromMillis(now) });
  }
  return gameId;
}
