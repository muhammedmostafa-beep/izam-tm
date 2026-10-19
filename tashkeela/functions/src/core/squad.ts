// Organizer-only squad tools: each player's level, and a game's teams.

import { Firestore, Timestamp } from "firebase-admin/firestore";
import { TeamsError, validateTeams } from "../domain/teams";
import { GameDoc, Level, MemberDoc } from "../model";
import { AppError, invalid } from "./errors";
import { gameRef, groupRef } from "./games";
import { loadGroup, requireAdmin } from "./groups";

export const levelsRef = (db: Firestore, groupId: string) => groupRef(db, groupId).collection("private").doc("levels");

/** 1 top, 2 about 70%, 3 about 50% or below, 4 weak, 0 new / not sure. Only organizers can read these. */
export async function setMemberLevel(
  db: Firestore,
  input: { groupId: string; uid: string; memberId: string; level: unknown; now: number },
): Promise<void> {
  requireAdmin(await loadGroup(db, input.groupId), input.uid);
  if (!Number.isInteger(input.level) || (input.level as number) < 0 || (input.level as number) > 4) {
    throw invalid("level must be 0, 1, 2, 3 or 4");
  }
  const member = await groupRef(db, input.groupId).collection("members").doc(input.memberId).get();
  if (!member.exists) throw new AppError("not_found", "member not found");
  await levelsRef(db, input.groupId).set(
    { levels: { [input.memberId]: input.level as Level }, updatedAt: Timestamp.fromMillis(input.now) },
    { merge: true },
  );
}

/** Save a game's teams (or clear them with null). Everyone in the group can see the teams, not the levels. */
export async function saveTeams(
  db: Firestore,
  input: { groupId: string; uid: string; gameId: string; teams: unknown; now: number },
): Promise<void> {
  requireAdmin(await loadGroup(db, input.groupId), input.uid);
  const ref = gameRef(db, input.groupId, input.gameId);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError("not_found", "game not found");
  const game = snap.data() as GameDoc;
  if (game.status === "cancelled" || game.status === "played") throw invalid("this game is already over");
  const stamp = Timestamp.fromMillis(input.now);
  if (input.teams === null) {
    await ref.update({ teams: null, updatedAt: stamp });
    return;
  }
  const members = await groupRef(db, input.groupId).collection("members").get();
  const ids = new Set(members.docs.filter((d) => (d.data() as MemberDoc).active).map((d) => d.id));
  let teams;
  try {
    teams = validateTeams(input.teams, ids);
  } catch (e) {
    throw invalid((e as TeamsError).message);
  }
  await ref.update({ teams: { teams, updatedAt: stamp, updatedBy: input.uid }, updatedAt: stamp });
}
