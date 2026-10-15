import { FieldValue, Firestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { gameRef, groupRef } from "../core/games";
import { toWaId } from "../core/phone";
import { entryFromDoc, EntryDoc, GameDoc, GroupDoc, MemberDoc, UserDoc } from "../model";
import { rosterView } from "../domain/roster";
import { buttonPayload, formatClock, formatNumber, formatWhen, pushText, PushText, TEMPLATES } from "./messages";
import { Notice } from "./notices";
import { PushSender, WhatsAppSender } from "./senders";

export interface Senders {
  push: PushSender;
  /** Null when WhatsApp is not configured; push still works. */
  whatsapp: WhatsAppSender | null;
}

interface Recipient {
  memberId: string;
  member: MemberDoc;
}

interface Outgoing {
  recipients: Recipient[];
  push: (r: Recipient) => PushText;
  whatsapp?: (r: Recipient) => { template: string; params: string[]; buttons?: string[] };
}

/**
 * Deliver notices. Best effort: a failed message is logged and never undoes
 * the roster change that caused it.
 */
export async function dispatch(db: Firestore, notices: Notice[], senders: Senders): Promise<void> {
  for (const notice of notices) {
    try {
      await deliver(db, notice, senders);
    } catch (e) {
      logger.error("notice delivery failed", { notice, error: (e as Error).message });
    }
  }
}

async function deliver(db: Firestore, n: Notice, senders: Senders): Promise<void> {
  const [gSnap, gameSnap] = await db.getAll(groupRef(db, n.groupId), gameRef(db, n.groupId, n.gameId));
  if (!gSnap.exists || !gameSnap.exists) return;
  const group = gSnap.data() as GroupDoc;
  const game = gameSnap.data() as GameDoc;
  const tz = group.schedule.timeZone;
  const kickoff = game.kickoffAt.toMillis();
  const members = await groupRef(db, n.groupId).collection("members").where("active", "==", true).get();
  const all: Recipient[] = members.docs.map((d) => ({ memberId: d.id, member: d.data() as MemberDoc }));
  const byId = (id: string) => all.filter((r) => r.memberId === id);
  const when = (r: Recipient) => formatWhen(kickoff, tz, r.member.language);
  const data = { groupId: n.groupId, gameId: n.gameId, kind: n.kind };

  let out: Outgoing;
  switch (n.kind) {
    case "poll_open":
      out = {
        recipients: all,
        push: (r) => pushText.pollOpen(r.member.language, { group: group.name, when: when(r), spots: group.rules.squadSize }),
        whatsapp: !group.reminders.pollOpening ? undefined : (r) => ({
          template: TEMPLATES.pollOpen,
          params: [when(r), group.venue, formatNumber(group.rules.squadSize, r.member.language)],
          buttons: [buttonPayload("JOIN", n.groupId, n.gameId), buttonPayload("SKIP", n.groupId, n.gameId)],
        }),
      };
      break;
    case "offered":
      out = {
        recipients: byId(n.memberId),
        push: (r) => pushText.offered(r.member.language, { when: when(r), deadline: formatClock(n.expiresAt, tz, r.member.language) }),
        whatsapp: group.reminders.promotion
          ? (r) => ({
              template: TEMPLATES.spotOffered,
              params: [when(r), formatWhen(n.expiresAt, tz, r.member.language)],
              buttons: [buttonPayload("CONFIRM", n.groupId, n.gameId), buttonPayload("PASS", n.groupId, n.gameId)],
            })
          : undefined,
      };
      break;
    case "expired":
      out = { recipients: byId(n.memberId), push: (r) => pushText.expired(r.member.language) };
      break;
    case "match_day": {
      const entries = await gameRef(db, n.groupId, n.gameId).collection("entries").get();
      const squad = rosterView(
        entries.docs.map((d) => entryFromDoc(d.data() as EntryDoc)),
        group.rules.squadSize,
      ).squad.map((e) => e.memberId);
      out = {
        recipients: all.filter((r) => squad.includes(r.memberId)),
        push: (r) => pushText.matchDay(r.member.language, { time: formatClock(kickoff, tz, r.member.language), venue: group.venue }),
        whatsapp: !group.reminders.matchDay ? undefined : (r) => ({
          template: TEMPLATES.matchDay,
          params: [formatClock(kickoff, tz, r.member.language), group.venue, formatNumber(group.rules.squadSize, r.member.language)],
        }),
      };
      break;
    }
    case "dropped": {
      const name = all.find((r) => r.memberId === n.memberId)?.member.name ?? "?";
      const replacement = n.replacementId ? all.find((r) => r.memberId === n.replacementId)?.member.name ?? null : null;
      out = {
        recipients: all.filter((r) => r.member.role === "admin"),
        push: (r) => pushText.dropped(r.member.language, { name, replacement, late: n.late }),
      };
      break;
    }
  }

  try {
    await sendPush(db, out, senders.push, data);
  } catch (e) {
    // A push outage must not stop the WhatsApp messages below.
    logger.warn("push failed", { kind: n.kind, error: (e as Error).message });
  }
  if (out.whatsapp && senders.whatsapp) {
    const wa = senders.whatsapp;
    const build = out.whatsapp;
    await Promise.all(
      out.recipients
        .filter((r) => r.member.whatsappOptIn)
        .map(async (r) => {
          const m = build(r);
          try {
            await wa.sendTemplate(toWaId(r.member.phone), m.template, r.member.language, m.params, m.buttons);
          } catch (e) {
            logger.warn("whatsapp send failed", { memberId: r.memberId, error: (e as Error).message });
          }
        }),
    );
  }
}

async function sendPush(
  db: Firestore,
  out: Outgoing,
  push: PushSender,
  data: Record<string, string>,
): Promise<void> {
  const withApp = out.recipients.filter((r) => r.member.uid);
  if (!withApp.length) return;
  const users = await db.getAll(...withApp.map((r) => db.collection("users").doc(r.member.uid!)));
  await Promise.all(
    users.map(async (snap, i) => {
      const ids = (snap.data() as UserDoc | undefined)?.pushIds ?? [];
      if (!ids.length) return;
      const text = out.push(withApp[i]);
      const invalid = await push.send(ids, { ...text, data });
      if (invalid.length) await snap.ref.update({ pushIds: FieldValue.arrayRemove(...invalid) });
    }),
  );
}
