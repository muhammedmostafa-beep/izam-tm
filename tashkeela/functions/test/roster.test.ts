import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  confirm,
  dropOut,
  Entry,
  expireOffers,
  join,
  nextOfferExpiry,
  offerExpiry,
  pass,
  remove,
  RosterContext,
  RosterError,
  RosterRules,
  rosterView,
} from "../src/domain/roster";
import { HOUR, MINUTE } from "../src/domain/time";

const at = (iso: string) => Date.parse(iso);
const KICKOFF = at("2026-10-22T18:00:00Z"); // Thursday 21:00 in Cairo

const rules: RosterRules = {
  squadSize: 18,
  confirmWindowMinutes: 120,
  matchDayConfirmWindowMinutes: 30,
  lateDropOutHours: 24,
  quietHours: { start: "00:00", end: "08:00" },
  timeZone: "Africa/Cairo",
};

const ctxAt = (iso: string, overrides: Partial<RosterRules> = {}): RosterContext => ({
  now: at(iso),
  kickoffAt: KICKOFF,
  rules: { ...rules, ...overrides },
});

/** Fill the line with `count` players, p1 first. Poll opened Sunday 12:00 Cairo. */
function filled(count: number, overrides: Partial<RosterRules> = {}): Entry[] {
  let entries: Entry[] = [];
  for (let i = 1; i <= count; i++) {
    entries = join(entries, { memberId: `p${i}`, name: `Player ${i}` }, i, "app", ctxAt("2026-10-18T09:00:00Z", overrides)).entries;
  }
  return entries;
}

const stateOf = (entries: Entry[], id: string) => entries.find((e) => e.memberId === id)?.state;

describe("joining", () => {
  it("puts the first 18 in the squad and queues the rest", () => {
    const entries = filled(20);
    const view = rosterView(entries, 18);
    assert.equal(view.squad.length, 18);
    assert.deepEqual(view.reserves.map((e) => e.memberId), ["p19", "p20"]);
    assert.equal(stateOf(entries, "p18"), "confirmed");
    assert.equal(stateOf(entries, "p19"), "waiting");
  });

  it("reports the position and whether the player made the squad", () => {
    const r = join(filled(18), { memberId: "x", name: "X" }, 99, "whatsapp", ctxAt("2026-10-18T09:05:00Z"));
    assert.deepEqual(r.events, [{ type: "joined", memberId: "x", position: 19, inSquad: false }]);
    assert.deepEqual(r.changed, ["x"]);
  });

  it("orders by sequence number, not by array order", () => {
    const shuffled = filled(19).reverse();
    assert.equal(rosterView(shuffled, 18).reserves[0].memberId, "p19");
  });

  it("refuses a second vote and votes after kick-off", () => {
    const entries = filled(3);
    assert.throws(
      () => join(entries, { memberId: "p1", name: "P1" }, 10, "app", ctxAt("2026-10-18T10:00:00Z")),
      (e: RosterError) => e.code === "already_in",
    );
    assert.throws(
      () => join(entries, { memberId: "z", name: "Z" }, 10, "app", ctxAt("2026-10-22T18:00:00Z")),
      (e: RosterError) => e.code === "game_started",
    );
  });

  it("lets a player who dropped out rejoin at the back of the line", () => {
    let entries = dropOut(filled(20), "p2", ctxAt("2026-10-19T10:00:00Z")).entries;
    entries = confirm(entries, "p19", ctxAt("2026-10-19T10:30:00Z")).entries;
    const r = join(entries, { memberId: "p2", name: "Player 2" }, 21, "app", ctxAt("2026-10-19T11:00:00Z"));
    const view = rosterView(r.entries, 18);
    assert.deepEqual(view.reserves.map((e) => e.memberId), ["p20", "p2"]);
  });
});

describe("drop-outs and promotion", () => {
  it("offers the spot to reserve #1 for two hours", () => {
    const r = dropOut(filled(20), "p5", ctxAt("2026-10-19T10:00:00Z")); // Monday 13:00 Cairo
    assert.equal(stateOf(r.entries, "p5"), "out");
    assert.equal(stateOf(r.entries, "p19"), "offered");
    assert.equal(stateOf(r.entries, "p20"), "waiting");
    assert.deepEqual(r.events, [
      { type: "dropped", memberId: "p5", late: false, wasInSquad: true },
      { type: "offered", memberId: "p19", expiresAt: at("2026-10-19T12:00:00Z") },
    ]);
    assert.deepEqual(r.changed.sort(), ["p19", "p5"]);
  });

  it("keeps the offered reserve in the 18th place while they decide", () => {
    const r = dropOut(filled(20), "p5", ctxAt("2026-10-19T10:00:00Z"));
    const view = rosterView(r.entries, 18);
    assert.equal(view.squad.at(-1)?.memberId, "p19");
    assert.deepEqual(view.reserves.map((e) => e.memberId), ["p20"]);
  });

  it("confirms an offer", () => {
    const offered = dropOut(filled(20), "p5", ctxAt("2026-10-19T10:00:00Z")).entries;
    const r = confirm(offered, "p19", ctxAt("2026-10-19T10:30:00Z"));
    assert.equal(stateOf(r.entries, "p19"), "confirmed");
    assert.equal(r.entries.find((e) => e.memberId === "p19")?.offerExpiresAt, undefined);
    assert.deepEqual(r.events, [{ type: "confirmed", memberId: "p19" }]);
  });

  it("moves the spot to the next reserve when the offer is passed", () => {
    const offered = dropOut(filled(20), "p5", ctxAt("2026-10-19T10:00:00Z")).entries;
    const r = pass(offered, "p19", ctxAt("2026-10-19T10:30:00Z"));
    assert.equal(stateOf(r.entries, "p19"), "out");
    assert.equal(stateOf(r.entries, "p20"), "offered");
  });

  it("treats a drop-out by the offered reserve as a pass", () => {
    const offered = dropOut(filled(20), "p5", ctxAt("2026-10-19T10:00:00Z")).entries;
    const r = dropOut(offered, "p19", ctxAt("2026-10-19T10:30:00Z"));
    assert.equal(r.entries.find((e) => e.memberId === "p19")?.outReason, "passed");
    assert.equal(stateOf(r.entries, "p20"), "offered");
  });

  it("moves the spot on when an offer expires", () => {
    const offered = dropOut(filled(20), "p5", ctxAt("2026-10-19T10:00:00Z")).entries;
    assert.equal(nextOfferExpiry(offered), at("2026-10-19T12:00:00Z"));
    const early = expireOffers(offered, ctxAt("2026-10-19T11:59:00Z"));
    assert.deepEqual(early.events, []);
    assert.deepEqual(early.changed, []);
    const r = expireOffers(offered, ctxAt("2026-10-19T12:00:00Z"));
    assert.equal(r.entries.find((e) => e.memberId === "p19")?.outReason, "expired");
    assert.equal(stateOf(r.entries, "p20"), "offered");
  });

  it("leaves the squad short when the queue is empty", () => {
    const r = dropOut(filled(18), "p1", ctxAt("2026-10-19T10:00:00Z"));
    assert.equal(rosterView(r.entries, 18).squad.length, 17);
    assert.deepEqual(r.events.map((e) => e.type), ["dropped"]);
  });

  it("does not offer anything when a reserve drops out", () => {
    const r = dropOut(filled(20), "p19", ctxAt("2026-10-19T10:00:00Z"));
    assert.deepEqual(r.events, [{ type: "dropped", memberId: "p19", late: false, wasInSquad: false }]);
  });

  it("flags squad drop-outs in the last 24 hours as late", () => {
    const r = dropOut(filled(20), "p3", ctxAt("2026-10-21T18:00:00Z"));
    assert.equal(r.entries.find((e) => e.memberId === "p3")?.lateDropOut, true);
    const early = dropOut(filled(20), "p3", ctxAt("2026-10-21T17:59:00Z"));
    assert.equal(early.entries.find((e) => e.memberId === "p3")?.lateDropOut, false);
  });

  it("lets the organizer remove a player and fills the gap", () => {
    const r = remove(filled(19), "p4", ctxAt("2026-10-19T10:00:00Z"));
    assert.equal(r.entries.find((e) => e.memberId === "p4")?.outReason, "removed");
    assert.equal(stateOf(r.entries, "p19"), "offered");
  });

  it("rejects actions that do not apply", () => {
    const entries = filled(20);
    const ctx = ctxAt("2026-10-19T10:00:00Z");
    assert.throws(() => confirm(entries, "p19", ctx), (e: RosterError) => e.code === "no_offer");
    assert.throws(() => pass(entries, "p1", ctx), (e: RosterError) => e.code === "no_offer");
    assert.throws(() => dropOut(entries, "nobody", ctx), (e: RosterError) => e.code === "not_in");
    const dropped = dropOut(entries, "p1", ctx).entries;
    assert.throws(() => dropOut(dropped, "p1", ctx), (e: RosterError) => e.code === "not_in");
  });

  it("sends players back to the queue if the squad shrinks", () => {
    const smaller = { squadSize: 16 };
    const r = dropOut(filled(18), "p1", ctxAt("2026-10-19T10:00:00Z", smaller));
    assert.equal(stateOf(r.entries, "p17"), "confirmed");
    assert.equal(stateOf(r.entries, "p18"), "waiting");
  });
});

describe("confirm window", () => {
  it("is 30 minutes on match day", () => {
    const ctx = ctxAt("2026-10-22T12:00:00Z"); // Thursday 15:00 Cairo
    assert.equal(offerExpiry(ctx), ctx.now + 30 * MINUTE);
  });

  it("never runs past kick-off", () => {
    const ctx = ctxAt("2026-10-22T17:50:00Z");
    assert.equal(offerExpiry(ctx), KICKOFF);
  });

  it("pauses overnight", () => {
    // Offered Monday 23:00 Cairo: one hour before midnight, one hour after 08:00.
    assert.equal(offerExpiry(ctxAt("2026-10-19T20:00:00Z")), at("2026-10-20T06:00:00Z"));
    // Offered Wednesday 02:00 Cairo: the window starts at 08:00.
    assert.equal(offerExpiry(ctxAt("2026-10-20T23:00:00Z")), at("2026-10-21T07:00:00Z"));
  });

  it("runs straight through when quiet hours are off", () => {
    const ctx = ctxAt("2026-10-19T20:00:00Z", { quietHours: null });
    assert.equal(offerExpiry(ctx), ctx.now + 2 * HOUR);
  });

  it("supports quiet hours that wrap past midnight", () => {
    const ctx = ctxAt("2026-10-19T19:00:00Z", { quietHours: { start: "23:00", end: "07:00" } });
    // Monday 22:00 Cairo: one hour, then the rest after 07:00.
    assert.equal(offerExpiry(ctx), at("2026-10-20T05:00:00Z"));
  });
});
