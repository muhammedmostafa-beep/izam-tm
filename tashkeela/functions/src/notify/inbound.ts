// Incoming WhatsApp messages: players tapping "I'm in", "Confirm" and so on.
// The sender's phone number decides who acts, so a forged button payload can
// never act for somebody else.

import { createHmac, timingSafeEqual } from "node:crypto";
import { Firestore, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { asAppError } from "../core/errors";
import { gameRef, groupRef } from "../core/games";
import { fromWaId } from "../core/phone";
import { applyRosterAction, RosterAction } from "../core/roster-ops";
import { GroupDoc, Language, MemberDoc } from "../model";
import { dispatch, Senders } from "./dispatch";
import { formatWhen, parseButtonPayload, replyText } from "./messages";

export interface InboundMessage {
  id: string;
  from: string; // wa_id: E.164 without "+"
  payload: string | null;
  text: string | null;
}

/** Meta signs each delivery with the app secret (X-Hub-Signature-256). */
export function verifySignature(rawBody: Buffer, header: string | undefined, appSecret: string): boolean {
  if (!header?.startsWith("sha256=") || !appSecret) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const given = Buffer.from(header.slice("sha256=".length), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Pull the messages we care about out of a webhook delivery. */
export function parseInbound(body: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const entries = (body as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries as { changes?: { value?: { messages?: unknown[] } }[] }[]) {
    for (const change of entry.changes ?? []) {
      for (const raw of (change.value?.messages ?? []) as Record<string, any>[]) {
        if (typeof raw.id !== "string" || typeof raw.from !== "string") continue;
        let payload: string | null = null;
        let text: string | null = null;
        if (raw.type === "button") payload = raw.button?.payload ?? null;
        else if (raw.type === "interactive") payload = raw.interactive?.button_reply?.id ?? null;
        else if (raw.type === "text") text = raw.text?.body ?? null;
        out.push({ id: raw.id, from: raw.from, payload, text });
      }
    }
  }
  return out;
}

const ACTIONS: Record<string, RosterAction> = { JOIN: "join", CONFIRM: "confirm", PASS: "pass" };

export async function handleInbound(
  db: Firestore,
  msg: InboundMessage,
  senders: Senders,
  appUrl: string,
  now: number,
): Promise<void> {
  const wa = senders.whatsapp;
  if (!wa) return;

  // Meta retries deliveries; act on each message once.
  try {
    await db.collection("waInbound").doc(msg.id).create({ at: Timestamp.fromMillis(now), from: msg.from });
  } catch (e) {
    if ((e as { code?: number }).code === 6) return; // ALREADY_EXISTS
    throw e;
  }

  const button = msg.payload ? parseButtonPayload(msg.payload) : null;
  if (!button) {
    await wa.sendText(msg.from, replyText.help(appUrl));
    return;
  }

  const members = await groupRef(db, button.groupId)
    .collection("members")
    .where("phone", "==", fromWaId(msg.from))
    .where("active", "==", true)
    .limit(1)
    .get();
  if (members.empty) {
    await wa.sendText(msg.from, `${replyText.error("ar", "not_member")}\n${replyText.error("en", "not_member")}`);
    return;
  }
  const memberId = members.docs[0].id;
  const lang: Language = (members.docs[0].data() as MemberDoc).language;

  if (button.action === "SKIP") {
    await wa.sendText(msg.from, replyText.skipped(lang));
    return;
  }

  const [gSnap, gameSnap] = await db.getAll(groupRef(db, button.groupId), gameRef(db, button.groupId, button.gameId));
  if (!gSnap.exists || !gameSnap.exists) {
    await wa.sendText(msg.from, replyText.error(lang, "game_closed"));
    return;
  }
  const tz = (gSnap.data() as GroupDoc).schedule.timeZone;

  try {
    const r = await applyRosterAction(db, {
      groupId: button.groupId,
      gameId: button.gameId,
      memberId,
      action: ACTIONS[button.action],
      source: "whatsapp",
      actorUid: null,
      now,
    });
    const when = formatWhen(r.kickoffAt, tz, lang);
    let reply: string;
    if (button.action === "JOIN") {
      reply =
        r.position !== null && r.position <= r.squadSize
          ? replyText.joinedSquad(lang, { position: r.position, squadSize: r.squadSize, when })
          : replyText.joinedReserve(lang, { reserve: (r.position ?? r.squadSize + 1) - r.squadSize, when });
    } else if (button.action === "CONFIRM") {
      reply = replyText.confirmed(lang, { when });
    } else {
      reply = replyText.passed(lang);
    }
    await wa.sendText(msg.from, reply);
    await dispatch(db, r.notices, senders);
  } catch (e) {
    const appError = asAppError(e);
    if (!appError) throw e;
    logger.info("whatsapp action refused", { code: appError.code, memberId });
    await wa.sendText(msg.from, replyText.error(lang, appError.code));
  }
}
