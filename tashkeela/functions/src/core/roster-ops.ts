import { Firestore, Timestamp } from "firebase-admin/firestore";
import * as roster from "../domain/roster";
import { PENALTY_SEQ } from "../domain/roster";
import { MINUTE } from "../domain/time";
import { Entry, RosterContext, RosterEvent, RosterResult, Source } from "../domain/roster";
import { entryFromDoc, EntryDoc, entryToDoc, GameDoc, GroupDoc, MemberDoc, rosterRules } from "../model";
import { Notice, noticesFromEvents } from "../notify/notices";
import { AppError } from "./errors";
import { gameRef, groupRef } from "./games";

export type RosterAction = "join" | "drop" | "confirm" | "pass" | "remove" | "expire";

export interface RosterActionInput {
  groupId: string;
  gameId: string;
  /** The player acted on; not used by "expire". */
  memberId: string | null;
  action: RosterAction;
  source: Source;
  /** Who did it, for the log. Null for the scheduler and WhatsApp. */
  actorUid: string | null;
  now: number;
}

export interface RosterActionOutput {
  /** The acted-on player's entry afterwards, if any. */
  entry: Entry | null;
  /** 1-based place in the line, if still in it. */
  position: number | null;
  squadSize: number;
  kickoffAt: number;
  events: RosterEvent[];
  notices: Notice[];
}

/**
 * Apply one roster change atomically. The game document is read and written
 * in every change, so concurrent votes are serialized and each gets the next
 * sequence number.
 */
export async function applyRosterAction(
  db: Firestore,
  input: RosterActionInput,
): Promise<RosterActionOutput> {
  const { groupId, gameId, memberId, action, now } = input;
  const gRef = groupRef(db, groupId);
  const ref = gameRef(db, groupId, gameId);

  const out = await db.runTransaction(async (tx) => {
    const refs = [gRef, ref];
    if (memberId) refs.push(gRef.collection("members").doc(memberId));
    const [gSnap, gameSnap, memberSnap] = await tx.getAll(...refs);
    if (!gSnap.exists) throw new AppError("not_found", "group not found");
    if (!gameSnap.exists) throw new AppError("not_found", "game not found");
    const group = gSnap.data() as GroupDoc;
    const game = gameSnap.data() as GameDoc;
    const member = memberSnap?.exists ? (memberSnap.data() as MemberDoc) : null;

    const entriesSnap = await tx.get(ref.collection("entries"));
    const entries = entriesSnap.docs.map((d) => entryFromDoc(d.data() as EntryDoc));
    const kickoffAt = game.kickoffAt.toMillis();
    const ctx: RosterContext = { now, kickoffAt, rules: rosterRules(group, game) };

    // Regulars may vote during the head start, before the poll opens for everyone.
    const headStart = group.rules.regularsHeadStartMinutes ?? 0;
    const early =
      game.status === "scheduled" &&
      headStart > 0 &&
      member?.isRegular === true &&
      now >= game.pollOpensAt.toMillis() - headStart * MINUTE;
    if (action !== "expire") {
      if (game.status === "scheduled" && !early) throw new AppError("poll_not_open");
      if ((game.status !== "open" && !early) || now >= kickoffAt) throw new AppError("game_closed");
    }

    let result: RosterResult;
    let nextSeq = game.nextSeq;
    switch (action) {
      case "join": {
        if (!member || !member.active) throw new AppError("not_member");
        // A late drop-out last time starts this poll behind everyone who votes normally.
        const penalty = member.reserveNext;
        const penalized =
          group.rules.lateDropOutsStartAsReserves === true &&
          !!penalty &&
          penalty.gameId !== gameId &&
          penalty.since.toMillis() < kickoffAt;
        const seq = penalized ? PENALTY_SEQ + nextSeq : nextSeq;
        result = roster.join(entries, { memberId: memberId!, name: member.name }, seq, input.source, ctx);
        nextSeq += 1;
        break;
      }
      case "drop":
        result = roster.dropOut(entries, memberId!, ctx);
        break;
      case "confirm":
        result = roster.confirm(entries, memberId!, ctx);
        break;
      case "pass":
        result = roster.pass(entries, memberId!, ctx);
        break;
      case "remove":
        result = roster.remove(entries, memberId!, ctx);
        break;
      case "expire":
        result = roster.expireOffers(entries, ctx);
        break;
    }

    const stamp = Timestamp.fromMillis(now);
    for (const id of result.changed) {
      const e = result.entries.find((x) => x.memberId === id)!;
      tx.set(ref.collection("entries").doc(id), entryToDoc(e));
    }
    const view = roster.rosterView(result.entries, ctx.rules.squadSize);
    const expiry = roster.nextOfferExpiry(result.entries);
    tx.update(ref, {
      nextSeq,
      squadSize: ctx.rules.squadSize,
      squadCount: view.squad.length,
      reserveCount: view.reserves.length,
      nextOfferExpiry: expiry === null ? null : Timestamp.fromMillis(expiry),
      updatedAt: stamp,
    });
    // Late drop-outs start the next poll as reserves, when the group uses that rule.
    if (group.rules.lateDropOutsStartAsReserves) {
      for (const ev of result.events) {
        if (ev.type === "dropped" && ev.late) {
          tx.update(gRef.collection("members").doc(ev.memberId), { reserveNext: { gameId, since: game.kickoffAt } });
        }
      }
    }
    for (const ev of result.events) {
      tx.set(ref.collection("log").doc(), {
        ...ev,
        ...("expiresAt" in ev ? { expiresAt: Timestamp.fromMillis(ev.expiresAt) } : {}),
        at: stamp,
        source: input.source,
        actorUid: input.actorUid,
      });
    }

    const entry = memberId ? result.entries.find((e) => e.memberId === memberId) ?? null : null;
    const line = [...view.squad, ...view.reserves];
    const index = entry ? line.findIndex((e) => e.memberId === entry.memberId) : -1;
    return {
      entry,
      position: index >= 0 ? index + 1 : null,
      squadSize: ctx.rules.squadSize,
      kickoffAt,
      events: result.events,
    };
  });

  return { ...out, notices: noticesFromEvents(groupId, gameId, out.events) };
}
