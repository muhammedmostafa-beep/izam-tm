import { Firestore, Timestamp } from "firebase-admin/firestore";
import { HOUR } from "../domain/time";
import { GameDoc, GroupDoc } from "../model";
import { Notice } from "../notify/notices";
import { ensureCurrentGame, gameRef, groupRef } from "./games";
import { applyRosterAction } from "./roster-ops";

/**
 * One scheduler pass for a group: create this week's game, open the poll on
 * time, close it at kick-off, send the match-day reminder once, and move
 * expired offers down the reserve queue. Costs two reads when nothing is due.
 */
export async function tickGroup(db: Firestore, groupId: string, now: number): Promise<Notice[]> {
  const { gameId } = await ensureCurrentGame(db, groupId, now);
  const ref = gameRef(db, groupId, gameId);
  const notices: Notice[] = [];

  const game = await db.runTransaction(async (tx) => {
    const [gSnap, snap] = await tx.getAll(groupRef(db, groupId), ref);
    const group = gSnap.data() as GroupDoc;
    const game = snap.data() as GameDoc;
    const kickoff = game.kickoffAt.toMillis();
    const updates: Partial<GameDoc> = {};
    let status = game.status;

    if (status === "scheduled" && now >= game.pollOpensAt.toMillis()) status = "open";
    if (status === "open" && !game.pollOpenNotified && now < kickoff) {
      updates.pollOpenNotified = true;
      notices.push({ kind: "poll_open", groupId, gameId });
    }
    const reminderAt = kickoff - group.reminders.matchDayHoursBefore * HOUR;
    if (status === "open" && !game.matchDayReminderSent && now >= reminderAt && now < kickoff) {
      updates.matchDayReminderSent = true;
      notices.push({ kind: "match_day", groupId, gameId });
    }
    if (status === "open" && now >= kickoff) status = "closed";

    if (status !== game.status) updates.status = status;
    if (Object.keys(updates).length) {
      tx.update(ref, { ...updates, updatedAt: Timestamp.fromMillis(now) });
    }
    return { ...game, ...updates };
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
  return notices;
}
