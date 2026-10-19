// Leaving a group, and deleting your account and data (Egypt's Personal Data
// Protection Law, Law 151 of 2020): your name and number are removed from
// every group; game records keep only "Former member".

import { FieldValue, Firestore } from "firebase-admin/firestore";
import { MemberDoc, StatsDoc, UserDoc } from "../model";
import { Notice } from "../notify/notices";
import { AppError } from "./errors";
import { groupRef } from "./games";
import { loadGroup, memberForUid, takeOutOfGroup } from "./groups";
import { levelsRef } from "./squad";

export const FORMER_MEMBER = "Former member";

export async function leaveGroup(db: Firestore, input: { groupId: string; uid: string; now: number }): Promise<Notice[]> {
  const group = await loadGroup(db, input.groupId);
  const { memberId } = await memberForUid(db, input.groupId, input.uid);
  return takeOutOfGroup(db, group, input.groupId, memberId, input.uid, input.now);
}

/**
 * Leave every group and erase your name and number. Refused while you are the
 * only organizer of a group, so no group is left without one.
 */
export async function deleteAccount(db: Firestore, input: { uid: string; now: number }): Promise<Notice[]> {
  const user = (await db.collection("users").doc(input.uid).get()).data() as UserDoc | undefined;
  const groupIds = user?.groupIds ?? [];
  const memberships: { groupId: string; memberId: string }[] = [];
  for (const groupId of groupIds) {
    const group = await loadGroup(db, groupId).catch(() => null);
    if (!group) continue;
    if (group.adminUids.length === 1 && group.adminUids[0] === input.uid) {
      throw new AppError("last_organizer", `make someone else organizer of ${group.name} first`);
    }
    const m = await memberForUid(db, groupId, input.uid).catch(() => null);
    if (m) memberships.push({ groupId, memberId: m.memberId });
  }

  const notices: Notice[] = [];
  for (const { groupId, memberId } of memberships) {
    const group = await loadGroup(db, groupId);
    notices.push(...(await takeOutOfGroup(db, group, groupId, memberId, input.uid, input.now)));
    const anonymous: Partial<MemberDoc> = { name: FORMER_MEMBER, phone: "", uid: null, active: false };
    await groupRef(db, groupId).collection("members").doc(memberId).update(anonymous);
    // Entries are keyed by member id: rename them in every game.
    const games = await groupRef(db, groupId).collection("games").get();
    for (const game of games.docs) {
      const entry = game.ref.collection("entries").doc(memberId);
      if ((await entry.get()).exists) await entry.update({ name: FORMER_MEMBER });
    }
    await levelsRef(db, groupId).set({ levels: { [memberId]: FieldValue.delete() } }, { merge: true });
    // Season tables (this one and past ones) keep the numbers, not the name.
    const seasons = await groupRef(db, groupId).collection("stats").get();
    for (const doc of seasons.docs) {
      if ((doc.data() as StatsDoc).players[memberId]) await doc.ref.update({ [`players.${memberId}.name`]: FORMER_MEMBER });
    }
  }
  await db.collection("users").doc(input.uid).delete();
  return notices;
}
