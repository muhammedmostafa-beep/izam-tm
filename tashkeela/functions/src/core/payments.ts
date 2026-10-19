// Paying the pitch: the fee is split among the players of a game. Players
// say when they've paid; the organizer confirms (or marks anyone as paid) and
// can remind whoever hasn't.

import { Firestore, Timestamp } from "firebase-admin/firestore";
import { PaymentState, splitFee, unpaid } from "../domain/payments";
import { rosterView } from "../domain/roster";
import { entryFromDoc, EntryDoc, GameDoc, GroupDoc } from "../model";
import { Notice } from "../notify/notices";
import { AppError, invalid } from "./errors";
import { gameRef } from "./games";
import { loadGroup, memberForUid, requireAdmin } from "./groups";

/** Who played: the squad at kick-off. */
export async function squadOf(db: Firestore, groupId: string, gameId: string, squadSize: number): Promise<string[]> {
  const entries = await gameRef(db, groupId, gameId).collection("entries").get();
  return rosterView(
    entries.docs.map((d) => entryFromDoc(d.data() as EntryDoc)),
    squadSize,
  ).squad.map((e) => e.memberId);
}

const afterKickoff = (g: GameDoc) => g.status === "closed" || g.status === "played";

/** At kick-off: split the group's pitch fee among the squad, if the group has one. */
export async function startPayments(db: Firestore, group: GroupDoc, groupId: string, gameId: string, now: number): Promise<void> {
  const ref = gameRef(db, groupId, gameId);
  const game = (await ref.get()).data() as GameDoc;
  if (!group.pitchFee || game.payments) return;
  const squad = await squadOf(db, groupId, gameId, game.squadSize);
  if (!squad.length) return;
  await ref.update({ payments: { ...splitFee(group.pitchFee, squad), updatedAt: Timestamp.fromMillis(now) } });
}

/** Organizer: set this game's fee (or null for none). Recomputes everyone's share. */
export async function setGameFee(
  db: Firestore,
  input: { groupId: string; uid: string; gameId: string; fee: unknown; now: number },
): Promise<void> {
  requireAdmin(await loadGroup(db, input.groupId), input.uid);
  const fee = input.fee;
  if (fee !== null && !(typeof fee === "number" && Number.isFinite(fee) && fee >= 0 && fee < 1_000_000)) {
    throw invalid("fee must be a positive number");
  }
  const ref = gameRef(db, input.groupId, input.gameId);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError("not_found", "game not found");
  const game = snap.data() as GameDoc;
  if (!afterKickoff(game)) throw invalid("payments start at kick-off");
  if (!fee) {
    await ref.update({ payments: null });
    return;
  }
  const squad = await squadOf(db, input.groupId, input.gameId, game.squadSize);
  await ref.update({ payments: { ...splitFee(fee, squad, game.payments), updatedAt: Timestamp.fromMillis(input.now) } });
}

/** Organizer: mark a player paid or unpaid. */
export async function setPayment(
  db: Firestore,
  input: { groupId: string; uid: string; gameId: string; memberId: string; state: unknown; now: number },
): Promise<void> {
  requireAdmin(await loadGroup(db, input.groupId), input.uid);
  if (input.state !== "paid" && input.state !== "unpaid") throw invalid("state must be paid or unpaid");
  await updateState(db, input.groupId, input.gameId, input.memberId, input.state, input.now);
}

/** A player says they've paid; the organizer then confirms. */
export async function claimPayment(
  db: Firestore,
  input: { groupId: string; uid: string; gameId: string; now: number },
): Promise<void> {
  const { memberId } = await memberForUid(db, input.groupId, input.uid);
  await updateState(db, input.groupId, input.gameId, memberId, "claimed", input.now, ["unpaid"]);
}

async function updateState(
  db: Firestore,
  groupId: string,
  gameId: string,
  memberId: string,
  state: PaymentState,
  now: number,
  onlyFrom?: PaymentState[],
): Promise<void> {
  const ref = gameRef(db, groupId, gameId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("not_found", "game not found");
    const payments = (snap.data() as GameDoc).payments;
    const current = payments?.players[memberId];
    if (!payments || !current) throw new AppError("not_in", "not on this game's payment list");
    if (onlyFrom && !onlyFrom.includes(current)) return;
    tx.update(ref, { [`payments.players.${memberId}`]: state, "payments.updatedAt": Timestamp.fromMillis(now) });
  });
}

/** Organizer: remind everyone who hasn't paid (push and WhatsApp). */
export async function remindUnpaid(
  db: Firestore,
  input: { groupId: string; uid: string; gameId: string },
): Promise<{ notices: Notice[]; reminded: number }> {
  requireAdmin(await loadGroup(db, input.groupId), input.uid);
  const snap = await gameRef(db, input.groupId, input.gameId).get();
  const payments = (snap.data() as GameDoc | undefined)?.payments;
  if (!payments) throw new AppError("not_found", "no payments for this game");
  const memberIds = unpaid(payments);
  return {
    notices: memberIds.length ? [{ kind: "payment_due", groupId: input.groupId, gameId: input.gameId, memberIds }] : [],
    reminded: memberIds.length,
  };
}
