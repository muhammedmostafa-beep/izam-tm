import { Firestore, Timestamp } from "firebase-admin/firestore";
import { HOUR, MINUTE } from "../domain/time";
import { GameDoc, GroupDoc } from "../model";
import { Notice } from "../notify/notices";
import { ACTIVE_STATUSES, ensureWeeklyGame, gameRef, groupRef, refreshCurrentGame } from "./games";
import { applyRosterAction } from "./roster-ops";
import { closeMvp, onKickoff } from "./season";

/**
 * One scheduler pass for a group: create this week's poll, then for every
 * poll still ahead open it on time, send the match-day reminder once, close
 * it at kick-off and move expired offers down the reserve queue.
 */
export async function tickGroup(db: Firestore, groupId: string, now: number): Promise<Notice[]> {
  const weekly = await ensureWeeklyGame(db, groupId, now);
  const active = await groupRef(db, groupId).collection("games").where("status", "in", ACTIVE_STATUSES).get();
  const notices: Notice[] = [];
  let changed = weekly.created;
  for (const doc of active.docs) {
    const r = await tickGame(db, groupId, doc.id, now);
    notices.push(...r.notices);
    changed ||= r.statusChanged;
  }
  if (changed) await refreshCurrentGame(db, groupId, now);

  // MVP voting closes a day after kick-off.
  const mvpDue = await groupRef(db, groupId).collection("games").where("mvpClosesAt", "<=", Timestamp.fromMillis(now)).get();
  for (const doc of mvpDue.docs) await closeMvp(db, groupId, doc.id, now);
  return notices;
}

async function tickGame(
  db: Firestore,
  groupId: string,
  gameId: string,
  now: number,
): Promise<{ notices: Notice[]; statusChanged: boolean }> {
  const ref = gameRef(db, groupId, gameId);
  const notices: Notice[] = [];

  const { game, statusChanged } = await db.runTransaction(async (tx) => {
    const [gSnap, snap] = await tx.getAll(groupRef(db, groupId), ref);
    const group = gSnap.data() as GroupDoc;
    const game = snap.data() as GameDoc;
    const kickoff = game.kickoffAt.toMillis();
    const updates: Partial<GameDoc> = {};
    let status = game.status;

    // The regulars' head start: they hear first, and may vote from then on.
    const opens = game.pollOpensAt.toMillis();
    const headStart = (group.rules.regularsHeadStartMinutes ?? 0) * MINUTE;
    if (status === "scheduled" && headStart > 0 && !game.earlyNotified && now >= opens - headStart && now < opens) {
      updates.earlyNotified = true;
      notices.push({ kind: "poll_open", groupId, gameId, audience: "regulars" });
    }
    if (status === "scheduled" && now >= opens) status = "open";
    if (status === "open" && !game.pollOpenNotified && now < kickoff) {
      updates.pollOpenNotified = true;
      notices.push(game.earlyNotified ? { kind: "poll_open", groupId, gameId, audience: "others" } : { kind: "poll_open", groupId, gameId });
    }
    const reminderAt = kickoff - group.reminders.matchDayHoursBefore * HOUR;
    if (status === "open" && !game.matchDayReminderSent && now >= reminderAt && now < kickoff) {
      updates.matchDayReminderSent = true;
      notices.push({ kind: "match_day", groupId, gameId });
    }
    if ((status === "open" || status === "scheduled") && now >= kickoff) status = "closed";

    if (status !== game.status) updates.status = status;
    if (Object.keys(updates).length) {
      tx.update(ref, { ...updates, updatedAt: Timestamp.fromMillis(now) });
    }
    return { game: { ...game, ...updates }, statusChanged: status !== game.status };
  });

  const live = game.status === "open" || game.status === "closed";
  if (live && game.nextOfferExpiry && game.nextOfferExpiry.toMillis() <= now) {
    const r = await applyRosterAction(db, {
      groupId,
      gameId,
      memberId: null,
      action: "expire",
      source: "admin",
      actorUid: null,
      now,
    });
    notices.push(...r.notices);
  }
  // Kick-off (after offers nobody answered have lapsed): split the pitch fee, open MVP voting,
  // lift last week's penalties, update the season table.
  if (statusChanged && game.status === "closed") await onKickoff(db, groupId, gameId, now);
  return { notices, statusChanged };
}
