// After the game and over the season: man-of-the-match votes and the season
// table (played, wins, MVPs, drop-outs). The table is rebuilt from the
// season's games whenever one of them changes, so it is always consistent.

import { FieldValue, Firestore, Timestamp } from "firebase-admin/firestore";
import { tally } from "../domain/mvp";
import { rosterView } from "../domain/roster";
import { GameRecord, seasonTable } from "../domain/stats";
import { HOUR } from "../domain/time";
import { BallotDoc, entryFromDoc, EntryDoc, GameDoc, GroupDoc, MemberDoc, Season, StatsDoc } from "../model";
import { AppError, invalid } from "./errors";
import { gameRef, groupRef } from "./games";
import { loadGroup, memberForUid, requireAdmin } from "./groups";
import { squadOf, startPayments } from "./payments";

/** MVP voting stays open this long after kick-off, unless the organizer closes it sooner. */
export const MVP_WINDOW = 24 * HOUR;

const ballotRef = (db: Firestore, groupId: string, gameId: string, memberId: string) =>
  groupRef(db, groupId).collection("ballots").doc(`${gameId}_${memberId}`);

export const seasonOf = (group: GroupDoc): Season =>
  group.season ?? { id: "s1", name: "Season 1", startedAt: group.createdAt };

/**
 * Everything that starts at kick-off: the pitch fee split, MVP voting, and
 * lifting last week's late-drop-out penalties.
 */
export async function onKickoff(db: Firestore, groupId: string, gameId: string, now: number): Promise<void> {
  const group = await loadGroup(db, groupId);
  const ref = gameRef(db, groupId, gameId);
  const game = (await ref.get()).data() as GameDoc;
  await startPayments(db, group, groupId, gameId, now);
  if (!game.mvp) {
    await ref.update({
      mvp: { voters: [], winners: null, winnerVotes: null },
      mvpClosesAt: Timestamp.fromMillis(game.kickoffAt.toMillis() + MVP_WINDOW),
    });
  }
  // A late drop-out sits out one poll as a reserve; this game was it.
  const penalized = await groupRef(db, groupId)
    .collection("members")
    .where("reserveNext.since", "<", game.kickoffAt)
    .get();
  for (const m of penalized.docs) {
    if ((m.data() as MemberDoc).reserveNext?.gameId !== gameId) await m.ref.update({ reserveNext: null });
  }
  await rebuildSeasonStats(db, groupId, now);
}

/** A player who played votes for someone else who played. They can change their vote until voting closes. */
export async function voteMvp(
  db: Firestore,
  input: { groupId: string; uid: string; gameId: string; choice: unknown; now: number },
): Promise<void> {
  const { memberId } = await memberForUid(db, input.groupId, input.uid);
  if (typeof input.choice !== "string") throw invalid("choose a player");
  const ref = gameRef(db, input.groupId, input.gameId);
  const game = (await ref.get()).data() as GameDoc | undefined;
  if (!game) throw new AppError("not_found", "game not found");
  if (!game.mvpClosesAt || input.now >= game.mvpClosesAt.toMillis()) throw invalid("MVP voting is closed");
  const squad = await squadOf(db, input.groupId, input.gameId, game.squadSize);
  if (!squad.includes(memberId)) throw invalid("only players of this game can vote");
  if (!squad.includes(input.choice) || input.choice === memberId) throw invalid("vote for someone else who played");

  const ballot: BallotDoc = { gameId: input.gameId, voter: memberId, choice: input.choice, at: Timestamp.fromMillis(input.now) };
  const batch = db.batch();
  batch.set(ballotRef(db, input.groupId, input.gameId, memberId), ballot);
  batch.update(ref, { "mvp.voters": FieldValue.arrayUnion(memberId) });
  await batch.commit();
}

/** Count the votes (when the window ends, or when the organizer closes voting). */
export async function closeMvp(db: Firestore, groupId: string, gameId: string, now: number): Promise<void> {
  const ref = gameRef(db, groupId, gameId);
  const game = (await ref.get()).data() as GameDoc | undefined;
  if (!game?.mvp || game.mvp.winners) return;
  const ballots = await groupRef(db, groupId).collection("ballots").where("gameId", "==", gameId).get();
  const result = tally(ballots.docs.map((d) => (d.data() as BallotDoc).choice));
  await ref.update({
    "mvp.winners": result.winners,
    "mvp.winnerVotes": result.winnerVotes,
    mvpClosesAt: null,
    updatedAt: Timestamp.fromMillis(now),
  });
  await rebuildSeasonStats(db, groupId, now);
}

export async function closeMvpNow(db: Firestore, input: { groupId: string; uid: string; gameId: string; now: number }) {
  requireAdmin(await loadGroup(db, input.groupId), input.uid);
  await closeMvp(db, input.groupId, input.gameId, input.now);
}

/** Organizer: start a new season. The old table stays; the new one starts empty. */
export async function startSeason(
  db: Firestore,
  input: { groupId: string; uid: string; name: unknown; now: number },
): Promise<{ seasonId: string }> {
  requireAdmin(await loadGroup(db, input.groupId), input.uid);
  if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 40) {
    throw invalid("season name is required (up to 40 characters)");
  }
  const season: Season = { id: `s${input.now}`, name: input.name.trim(), startedAt: Timestamp.fromMillis(input.now) };
  await groupRef(db, input.groupId).update({ season, updatedAt: Timestamp.fromMillis(input.now) });
  await rebuildSeasonStats(db, input.groupId, input.now);
  return { seasonId: season.id };
}

/** Rebuild the current season's table from its games. */
export async function rebuildSeasonStats(db: Firestore, groupId: string, now: number): Promise<void> {
  const group = await loadGroup(db, groupId);
  const season = seasonOf(group);
  const games = await groupRef(db, groupId).collection("games").where("kickoffAt", ">=", season.startedAt).get();
  const records: GameRecord[] = [];
  for (const doc of games.docs) {
    const game = doc.data() as GameDoc;
    if (game.status !== "closed" && game.status !== "played") continue;
    const entries = (await doc.ref.collection("entries").get()).docs.map((d) => d.data() as EntryDoc);
    const squad = rosterView(entries.map(entryFromDoc), game.squadSize).squad.map((e) => e.memberId);
    const winning = game.result && game.teams?.teams.find((t) => t.kit.name === game.result!.winner);
    const dropped = entries.filter((e) => e.state === "out" && e.outReason === "dropped");
    records.push({
      squad,
      winners: winning ? winning.memberIds : [],
      mvp: game.mvp?.winners ?? [],
      dropOuts: dropped.map((e) => e.memberId),
      lateDropOuts: dropped.filter((e) => e.lateDropOut).map((e) => e.memberId),
    });
  }
  const members = await groupRef(db, groupId).collection("members").get();
  const names = Object.fromEntries(members.docs.map((d) => [d.id, (d.data() as MemberDoc).name]));
  const stats: StatsDoc = {
    seasonId: season.id,
    name: season.name,
    startedAt: season.startedAt,
    games: records.length,
    players: seasonTable(records, names),
    updatedAt: Timestamp.fromMillis(now),
  };
  await groupRef(db, groupId).collection("stats").doc(season.id).set(stats);
}
