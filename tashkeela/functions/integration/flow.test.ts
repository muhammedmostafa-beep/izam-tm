// Runs against the Firestore emulator: `npm run test:emulator`.
import { strict as assert } from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { initializeApp } from "firebase-admin/app";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import { AppError } from "../src/core/errors";
import * as groups from "../src/core/groups";
import { applyRosterAction } from "../src/core/roster-ops";
import { tickGroup } from "../src/core/tick";
import { RosterError } from "../src/domain/roster";
import { EntryDoc, GameDoc, GroupDoc, MemberDoc } from "../src/model";
import { dispatch, Senders } from "../src/notify/dispatch";
import { handleInbound } from "../src/notify/inbound";
import { buttonPayload } from "../src/notify/messages";
import { PushMessage, WhatsAppSender } from "../src/notify/senders";

const PROJECT = "demo-tashkeela";
const at = (iso: string) => Date.parse(iso);
const SUNDAY_11AM = at("2026-10-18T08:00:00Z"); // Cairo, an hour before the poll opens
const GAME = "2026-10-22";

let db: Firestore;

class FakePush {
  sent: { ids: string[]; message: PushMessage }[] = [];
  async send(ids: string[], message: PushMessage) {
    this.sent.push({ ids, message });
    return ids.filter((t) => t.startsWith("dead"));
  }
}

class FakeWhatsApp implements WhatsAppSender {
  templates: { to: string; template: string; language: string; params: string[]; buttons: string[] }[] = [];
  texts: { to: string; text: string }[] = [];
  async sendTemplate(to: string, template: string, language: string, params: string[], buttons: string[] = []) {
    this.templates.push({ to, template, language, params, buttons });
  }
  async sendText(to: string, text: string) {
    this.texts.push({ to, text });
  }
}

async function clearFirestore() {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const res = await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
    method: "DELETE",
  });
  assert.equal(res.status, 200);
}

const phoneOf = (i: number) => `+2010000000${String(i).padStart(2, "0")}`;

/** A group with an organizer (uid "org") and `players` more members p1..pN. */
async function setupGroup(players: number): Promise<{ groupId: string; ids: string[] }> {
  const { groupId } = await groups.createGroup(db, {
    uid: "org",
    phone: "+201999999999",
    organizerName: "Organizer",
    name: "Thursday Night Football",
    venue: "New Cairo Arena",
    now: SUNDAY_11AM,
  });
  const ids: string[] = [];
  for (let i = 1; i <= players; i++) {
    const { memberId } = await groups.addMember(db, async () => null, {
      groupId,
      uid: "org",
      name: `Player ${i}`,
      phone: phoneOf(i),
      language: i % 2 ? "ar" : "en",
      now: SUNDAY_11AM,
    });
    ids.push(memberId);
  }
  return { groupId, ids };
}

const gameDoc = async (groupId: string) =>
  (await db.doc(`groups/${groupId}/games/${GAME}`).get()).data() as GameDoc;
const entryDoc = async (groupId: string, memberId: string) =>
  (await db.doc(`groups/${groupId}/games/${GAME}/entries/${memberId}`).get()).data() as EntryDoc | undefined;

const act = (groupId: string, memberId: string | null, action: "join" | "drop" | "confirm" | "pass" | "expire", now: number) =>
  applyRosterAction(db, { groupId, gameId: GAME, memberId, action, source: "app", actorUid: null, now });

before(() => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, "run with the Firestore emulator");
  initializeApp({ projectId: PROJECT });
  db = getFirestore();
});

beforeEach(clearFirestore);
after(clearFirestore);

describe("a week with the group", () => {
  it("creates this week's game when the group is created", async () => {
    const { groupId } = await setupGroup(0);
    const group = (await db.doc(`groups/${groupId}`).get()).data() as GroupDoc;
    assert.equal(group.currentGameId, GAME);
    const game = await gameDoc(groupId);
    assert.equal(game.status, "scheduled");
    assert.equal(game.weekNumber, 1);
    assert.equal(new Date(game.pollOpensAt.toMillis()).toISOString(), "2026-10-18T09:00:00.000Z");
  });

  it("refuses votes before the poll opens, then opens it on the minute", async () => {
    const { groupId, ids } = await setupGroup(1);
    await assert.rejects(act(groupId, ids[0], "join", SUNDAY_11AM), (e: AppError) => e.code === "poll_not_open");

    assert.deepEqual(await tickGroup(db, groupId, at("2026-10-18T08:59:00Z")), []);
    const notices = await tickGroup(db, groupId, at("2026-10-18T09:00:00Z"));
    assert.deepEqual(notices, [{ kind: "poll_open", groupId, gameId: GAME }]);
    assert.equal((await gameDoc(groupId)).status, "open");
    // Announced once only.
    assert.deepEqual(await tickGroup(db, groupId, at("2026-10-18T09:01:00Z")), []);
  });

  it("gives 20 simultaneous voters 20 distinct places", async () => {
    const { groupId, ids } = await setupGroup(20);
    await tickGroup(db, groupId, at("2026-10-18T09:00:00Z"));
    const now = at("2026-10-18T09:00:01Z");
    await Promise.all(ids.map((id) => act(groupId, id, "join", now)));

    const entries = (await db.collection(`groups/${groupId}/games/${GAME}/entries`).get()).docs.map(
      (d) => d.data() as EntryDoc,
    );
    assert.deepEqual(entries.map((e) => e.seq).sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1));
    assert.equal(entries.filter((e) => e.state === "confirmed").length, 18);
    assert.equal(entries.filter((e) => e.state === "waiting").length, 2);
    const game = await gameDoc(groupId);
    assert.equal(game.squadCount, 18);
    assert.equal(game.reserveCount, 2);
    assert.equal(game.nextSeq, 21);

    await assert.rejects(act(groupId, ids[0], "join", now), (e: RosterError) => e.code === "already_in");
  });

  it("moves a dropped spot down the reserve queue until someone confirms", async () => {
    const { groupId, ids } = await setupGroup(20);
    await tickGroup(db, groupId, at("2026-10-18T09:00:00Z"));
    for (const [i, id] of ids.entries()) await act(groupId, id, "join", at("2026-10-18T09:00:00Z") + i * 1000);
    const [r1, r2] = [ids[18], ids[19]];

    const drop = await act(groupId, ids[0], "drop", at("2026-10-19T10:00:00Z"));
    assert.deepEqual(drop.notices.map((n) => n.kind), ["dropped", "offered"]);
    assert.equal((await entryDoc(groupId, r1))?.state, "offered");
    const game = await gameDoc(groupId);
    assert.equal(new Date(game.nextOfferExpiry!.toMillis()).toISOString(), "2026-10-19T12:00:00.000Z");

    // Nothing happens before the deadline; afterwards the next reserve gets the offer.
    assert.deepEqual(await tickGroup(db, groupId, at("2026-10-19T11:59:00Z")), []);
    const expired = await tickGroup(db, groupId, at("2026-10-19T12:00:00Z"));
    assert.deepEqual(expired.map((n) => n.kind), ["expired", "offered"]);
    assert.equal((await entryDoc(groupId, r1))?.outReason, "expired");
    assert.equal((await entryDoc(groupId, r2))?.state, "offered");

    await act(groupId, r2, "confirm", at("2026-10-19T12:30:00Z"));
    assert.equal((await entryDoc(groupId, r2))?.state, "confirmed");
    assert.equal((await gameDoc(groupId)).nextOfferExpiry, null);

    const log = await db.collection(`groups/${groupId}/games/${GAME}/log`).get();
    assert.equal(log.size, 20 + 2 + 2 + 1); // joins, drop+offer, expiry+offer, confirm
  });

  it("sends the match-day reminder once and closes the poll at kick-off", async () => {
    const { groupId, ids } = await setupGroup(1);
    await tickGroup(db, groupId, at("2026-10-18T09:00:00Z"));
    await act(groupId, ids[0], "join", at("2026-10-18T09:00:00Z"));
    assert.deepEqual(await tickGroup(db, groupId, at("2026-10-22T13:59:00Z")), []);
    assert.deepEqual(await tickGroup(db, groupId, at("2026-10-22T14:00:00Z")), [{ kind: "match_day", groupId, gameId: GAME }]);
    assert.deepEqual(await tickGroup(db, groupId, at("2026-10-22T15:00:00Z")), []);
    await tickGroup(db, groupId, at("2026-10-22T18:00:00Z"));
    assert.equal((await gameDoc(groupId)).status, "closed");
    await assert.rejects(act(groupId, ids[0], "drop", at("2026-10-22T18:05:00Z")), (e: AppError) => e.code === "game_closed");

    // After the game ends the next week's game takes over.
    await tickGroup(db, groupId, at("2026-10-22T19:31:00Z"));
    const group = (await db.doc(`groups/${groupId}`).get()).data() as GroupDoc;
    assert.equal(group.currentGameId, "2026-10-29");
    assert.equal(group.weekCounter, 2);
  });

  it("records the champions only after kick-off, by an organizer", async () => {
    const { groupId } = await setupGroup(0);
    const input = { groupId, uid: "org", gameId: GAME, winner: "Lime", photoPath: `groups/${groupId}/champions/${GAME}.jpg` };
    await assert.rejects(groups.recordResult(db, { ...input, now: at("2026-10-22T17:00:00Z") }), (e: AppError) => e.code === "invalid");
    await assert.rejects(groups.recordResult(db, { ...input, uid: "someone", now: at("2026-10-22T20:00:00Z") }), (e: AppError) => e.code === "permission_denied");
    await assert.rejects(groups.recordResult(db, { ...input, winner: "Purple", now: at("2026-10-22T20:00:00Z") }), (e: AppError) => e.code === "invalid");
    await groups.recordResult(db, { ...input, now: at("2026-10-22T20:00:00Z") });
    const group = (await db.doc(`groups/${groupId}`).get()).data() as GroupDoc;
    assert.deepEqual(group.lastChampions, { gameId: GAME, weekNumber: 1, winner: "Lime", photoPath: input.photoPath });
    assert.equal((await gameDoc(groupId)).status, "played");
  });
});

describe("members", () => {
  it("links a player's sign-in to every group that lists their number", async () => {
    const { groupId, ids } = await setupGroup(2);
    const r = await groups.claimMemberships(db, { uid: "u1", phone: phoneOf(1) });
    assert.deepEqual(r.groupIds, [groupId]);
    const group = (await db.doc(`groups/${groupId}`).get()).data() as GroupDoc;
    assert.ok(group.memberUids.includes("u1"));
    assert.equal(((await db.doc(`groups/${groupId}/members/${ids[0]}`).get()).data() as MemberDoc).uid, "u1");
    const { memberId } = await groups.memberForUid(db, groupId, "u1");
    assert.equal(memberId, ids[0]);
  });

  it("rejects duplicate and invalid numbers, and non-organizers", async () => {
    const { groupId } = await setupGroup(1);
    const base = { groupId, uid: "org", name: "Dup", now: SUNDAY_11AM };
    await assert.rejects(groups.addMember(db, async () => null, { ...base, phone: phoneOf(1) }), (e: AppError) => e.code === "already_exists");
    await assert.rejects(groups.addMember(db, async () => null, { ...base, phone: "123" }), (e: AppError) => e.code === "invalid");
    await assert.rejects(groups.addMember(db, async () => null, { ...base, uid: "x", phone: "01011111111" }), (e: AppError) => e.code === "permission_denied");
    const added = await groups.addMember(db, async () => "existing-uid", { ...base, phone: "0101 111 1111" });
    assert.equal(added.linked, true);
    const member = (await db.doc(`groups/${groupId}/members/${added.memberId}`).get()).data() as MemberDoc;
    assert.equal(member.phone, "+201011111111");
  });

  it("takes a removed member off this week's list and offers their spot", async () => {
    const { groupId, ids } = await setupGroup(19);
    await groups.updateSettings(db, { groupId, uid: "org", patch: { rules: { squadSize: 18 } }, now: SUNDAY_11AM });
    await tickGroup(db, groupId, at("2026-10-18T09:00:00Z"));
    for (const [i, id] of ids.entries()) await act(groupId, id, "join", at("2026-10-18T09:00:00Z") + i * 1000);
    const notices = await groups.removeMember(db, { groupId, uid: "org", memberId: ids[2], now: at("2026-10-19T10:00:00Z") });
    assert.deepEqual(notices.map((n) => n.kind), ["offered"]);
    assert.equal((await entryDoc(groupId, ids[2]))?.outReason, "removed");
  });

  it("rebuilds next week's game when the schedule changes before the poll opens", async () => {
    const { groupId } = await setupGroup(0);
    await groups.updateSettings(db, { groupId, uid: "org", patch: { schedule: { matchWeekday: 5, matchTime: "22:00" } }, now: SUNDAY_11AM });
    const group = (await db.doc(`groups/${groupId}`).get()).data() as GroupDoc;
    assert.equal(group.currentGameId, "2026-10-23");
    assert.equal(group.weekCounter, 1);
    assert.equal((await db.doc(`groups/${groupId}/games/${GAME}`).get()).exists, false);
    await assert.rejects(
      groups.updateSettings(db, { groupId, uid: "org", patch: { schedule: { matchTime: "9pm" } }, now: SUNDAY_11AM }),
      (e: AppError) => e.code === "invalid",
    );
  });
});

describe("notifications", () => {
  it("pushes to app users and sends WhatsApp templates to opted-in members", async () => {
    const { groupId, ids } = await setupGroup(2);
    await groups.claimMemberships(db, { uid: "u1", phone: phoneOf(1) });
    await db.doc("users/u1").set({ pushIds: ["good", "dead-id"] }, { merge: true });
    const push = new FakePush();
    const whatsapp = new FakeWhatsApp();
    const senders: Senders = { push, whatsapp };

    await dispatch(db, [{ kind: "poll_open", groupId, gameId: GAME }], senders);
    assert.equal(push.sent.length, 1);
    assert.deepEqual(push.sent[0].ids, ["good", "dead-id"]);
    assert.equal((await db.doc("users/u1").get()).data()?.pushIds.length, 1, "stale ids are pruned");
    assert.equal(whatsapp.templates.length, 3); // organizer + 2 players
    const toP1 = whatsapp.templates.find((t) => t.to === phoneOf(1).slice(1))!;
    assert.equal(toP1.template, "tashkeela_poll_open");
    assert.equal(toP1.language, "ar");
    assert.deepEqual(toP1.buttons, [buttonPayload("JOIN", groupId, GAME), buttonPayload("SKIP", groupId, GAME)]);

    await groups.updateMyPreferences(db, { groupId, uid: "u1", whatsappOptIn: false });
    whatsapp.templates = [];
    await dispatch(db, [{ kind: "offered", groupId, gameId: GAME, memberId: ids[0], expiresAt: at("2026-10-19T12:00:00Z") }], senders);
    assert.equal(whatsapp.templates.length, 0, "opted out of WhatsApp");
  });

  it("still sends WhatsApp messages when push is down", async () => {
    const { groupId } = await setupGroup(1);
    await groups.claimMemberships(db, { uid: "u1", phone: phoneOf(1) });
    await db.doc("users/u1").set({ pushIds: ["id-1"] }, { merge: true });
    const whatsapp = new FakeWhatsApp();
    const brokenPush = { send: async () => Promise.reject(new Error("FCM unavailable")) };
    await dispatch(db, [{ kind: "poll_open", groupId, gameId: GAME }], { push: brokenPush, whatsapp });
    assert.equal(whatsapp.templates.length, 2);
  });

  it("lets players join and confirm by tapping WhatsApp buttons", async () => {
    const { groupId, ids } = await setupGroup(19);
    await tickGroup(db, groupId, at("2026-10-18T09:00:00Z"));
    for (const id of ids.slice(0, 18)) await act(groupId, id, "join", at("2026-10-18T09:00:00Z"));
    const whatsapp = new FakeWhatsApp();
    const senders: Senders = { push: new FakePush(), whatsapp };
    const from = phoneOf(19).slice(1);
    const tap = (id: string, action: "JOIN" | "CONFIRM", now: string) =>
      handleInbound(db, { id, from, payload: buttonPayload(action, groupId, GAME), text: null }, senders, "https://app", at(now));

    await tap("wamid.1", "JOIN", "2026-10-18T09:02:00Z");
    assert.equal((await entryDoc(groupId, ids[18]))?.source, "whatsapp");
    assert.match(whatsapp.texts[0].text, /reserve #1|احتياطي رقم ١ /);

    await tap("wamid.1", "JOIN", "2026-10-18T09:02:05Z"); // Meta retried the delivery
    assert.equal(whatsapp.texts.length, 1);

    await act(groupId, ids[0], "drop", at("2026-10-19T10:00:00Z"));
    await tap("wamid.2", "CONFIRM", "2026-10-19T10:10:00Z");
    assert.equal((await entryDoc(groupId, ids[18]))?.state, "confirmed");

    await handleInbound(
      db,
      { id: "wamid.3", from: "209999999999", payload: buttonPayload("JOIN", groupId, GAME), text: null },
      senders,
      "https://app",
      at("2026-10-19T10:11:00Z"),
    );
    assert.match(whatsapp.texts.at(-1)!.text, /isn't in this group/);
  });
});
