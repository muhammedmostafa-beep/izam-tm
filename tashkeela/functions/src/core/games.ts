import { Firestore, Timestamp } from "firebase-admin/firestore";
import { currentKickoff, gameIdFor, pollOpensAt } from "../domain/schedule";
import { GameDoc, GroupDoc } from "../model";
import { AppError } from "./errors";

export const groupRef = (db: Firestore, groupId: string) => db.collection("groups").doc(groupId);
export const gameRef = (db: Firestore, groupId: string, gameId: string) =>
  groupRef(db, groupId).collection("games").doc(gameId);

/**
 * Make sure the game that is current at `now` exists, creating it from the
 * group's weekly schedule if needed, and point the group at it.
 */
export async function ensureCurrentGame(
  db: Firestore,
  groupId: string,
  now: number,
): Promise<{ gameId: string; created: boolean }> {
  return db.runTransaction(async (tx) => {
    const gSnap = await tx.get(groupRef(db, groupId));
    if (!gSnap.exists) throw new AppError("not_found", "group not found");
    const group = gSnap.data() as GroupDoc;
    const kickoff = currentKickoff(now, group.schedule);
    const gameId = gameIdFor(kickoff, group.schedule.timeZone);
    const ref = gameRef(db, groupId, gameId);
    const existing = await tx.get(ref);
    const stamp = Timestamp.fromMillis(now);

    if (existing.exists) {
      if (group.currentGameId !== gameId) {
        tx.update(gSnap.ref, { currentGameId: gameId, updatedAt: stamp });
      }
      return { gameId, created: false };
    }

    const opens = pollOpensAt(kickoff, group.schedule);
    const weekNumber = group.weekCounter + 1;
    const game: GameDoc = {
      weekNumber,
      kickoffAt: Timestamp.fromMillis(kickoff),
      pollOpensAt: Timestamp.fromMillis(opens),
      status: now >= opens ? "open" : "scheduled",
      nextSeq: 1,
      squadSize: group.rules.squadSize,
      squadCount: 0,
      reserveCount: 0,
      nextOfferExpiry: null,
      pollOpenNotified: false,
      matchDayReminderSent: false,
      result: null,
      createdAt: stamp,
      updatedAt: stamp,
    };
    tx.set(ref, game);
    tx.update(gSnap.ref, { currentGameId: gameId, weekCounter: weekNumber, updatedAt: stamp });
    return { gameId, created: true };
  });
}
