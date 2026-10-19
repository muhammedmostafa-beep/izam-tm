// The weekly roster as pure functions: who is in the squad, who waits in the
// reserve queue, and how a free spot moves down the queue.
//
// Order is fixed by `seq`, which the server hands out one by one inside a
// transaction, so "who voted first" can never be disputed. The first
// `squadSize` active entries form the squad. A reserve who moves into the
// squad because someone dropped out gets an offer and must confirm it before
// the offer expires; otherwise the spot moves on to the next reserve.

import {
  addDays,
  localParts,
  MINUTE,
  minuteOfDay,
  parseClock,
  sameLocalDay,
  zonedToEpoch,
} from "./time";

export type EntryState = "confirmed" | "waiting" | "offered" | "out";
export type OutReason = "dropped" | "passed" | "expired" | "removed";
export type Source = "app" | "whatsapp" | "admin";

export interface Entry {
  memberId: string;
  name: string;
  seq: number;
  joinedAt: number;
  state: EntryState;
  source: Source;
  offerExpiresAt?: number;
  outReason?: OutReason;
  outAt?: number;
  lateDropOut?: boolean;
}

export interface QuietHours {
  start: string; // "HH:mm" local
  end: string; // "HH:mm" local
}

export interface RosterRules {
  squadSize: number;
  confirmWindowMinutes: number;
  matchDayConfirmWindowMinutes: number;
  lateDropOutHours: number;
  quietHours: QuietHours | null;
  timeZone: string;
}

export interface RosterContext {
  now: number;
  kickoffAt: number;
  rules: RosterRules;
}

export type RosterEvent =
  | { type: "joined"; memberId: string; position: number; inSquad: boolean }
  | { type: "offered"; memberId: string; expiresAt: number }
  | { type: "offer_withdrawn"; memberId: string }
  | { type: "confirmed"; memberId: string }
  | { type: "dropped"; memberId: string; late: boolean; wasInSquad: boolean }
  | { type: "passed"; memberId: string }
  | { type: "expired"; memberId: string }
  | { type: "removed"; memberId: string };

export interface RosterResult {
  entries: Entry[];
  /** Member ids whose entry differs from the input. */
  changed: string[];
  events: RosterEvent[];
}

export type RosterErrorCode =
  | "already_in"
  | "not_in"
  | "no_offer"
  | "game_started"
  | "unknown_member";

export class RosterError extends Error {
  constructor(public readonly code: RosterErrorCode, message?: string) {
    super(message ?? code);
    this.name = "RosterError";
  }
}

export interface RosterView {
  squad: Entry[];
  reserves: Entry[];
  out: Entry[];
}

/**
 * Added to the sequence number of a player who starts the poll as a reserve
 * (a late drop-out last time, when the group has that rule): everyone who
 * votes normally is ahead of them, whenever they vote.
 */
export const PENALTY_SEQ = 1_000_000;

const isActive = (e: Entry) => e.state !== "out";
const bySeq = (a: Entry, b: Entry) => a.seq - b.seq;

export function rosterView(entries: Entry[], squadSize: number): RosterView {
  const active = entries.filter(isActive).sort(bySeq);
  return {
    squad: active.slice(0, squadSize),
    reserves: active.slice(squadSize),
    out: entries.filter((e) => !isActive(e)).sort(bySeq),
  };
}

/** Add a player at the back of the line. */
export function join(
  entries: Entry[],
  player: { memberId: string; name: string },
  seq: number,
  source: Source,
  ctx: RosterContext,
): RosterResult {
  if (ctx.now >= ctx.kickoffAt) throw new RosterError("game_started");
  const existing = entries.find((e) => e.memberId === player.memberId);
  if (existing && isActive(existing)) throw new RosterError("already_in");

  // Usually the new entry is last in line; a penalized one (see PENALTY_SEQ) can land behind it.
  const ahead = entries.filter((e) => isActive(e) && e.seq < seq).length;
  const inSquad = ahead < ctx.rules.squadSize;
  const entry: Entry = {
    memberId: player.memberId,
    name: player.name,
    seq,
    joinedAt: ctx.now,
    state: inSquad ? "confirmed" : "waiting",
    source,
  };
  const next = entries.filter((e) => e.memberId !== player.memberId).concat(entry);
  const events: RosterEvent[] = [
    { type: "joined", memberId: player.memberId, position: ahead + 1, inSquad },
  ];
  return settle(entries, next, events, ctx);
}

/** A player in the squad or the queue can't make it. */
export function dropOut(entries: Entry[], memberId: string, ctx: RosterContext): RosterResult {
  const entry = find(entries, memberId);
  if (!isActive(entry)) throw new RosterError("not_in");
  if (entry.state === "offered") return pass(entries, memberId, ctx);

  const inSquad = rosterView(entries, ctx.rules.squadSize).squad.some(
    (e) => e.memberId === memberId,
  );
  const lateFrom = ctx.kickoffAt - ctx.rules.lateDropOutHours * 60 * MINUTE;
  const late = inSquad && ctx.now >= lateFrom;
  const next = replace(entries, {
    ...strip(entry),
    state: "out",
    outReason: "dropped",
    outAt: ctx.now,
    lateDropOut: late,
  });
  return settle(entries, next, [{ type: "dropped", memberId, late, wasInSquad: inSquad }], ctx);
}

/** The reserve accepts the spot they were offered. */
export function confirm(entries: Entry[], memberId: string, ctx: RosterContext): RosterResult {
  const entry = find(entries, memberId);
  if (entry.state !== "offered") throw new RosterError("no_offer");
  if (ctx.now >= ctx.kickoffAt) throw new RosterError("game_started");
  const next = replace(entries, { ...strip(entry), state: "confirmed" });
  return settle(entries, next, [{ type: "confirmed", memberId }], ctx);
}

/** The reserve turns the spot down; it moves on to the next in line. */
export function pass(entries: Entry[], memberId: string, ctx: RosterContext): RosterResult {
  const entry = find(entries, memberId);
  if (entry.state !== "offered") throw new RosterError("no_offer");
  const next = replace(entries, {
    ...strip(entry),
    state: "out",
    outReason: "passed",
    outAt: ctx.now,
  });
  return settle(entries, next, [{ type: "passed", memberId }], ctx);
}

/** The organizer takes a player off the list. */
export function remove(entries: Entry[], memberId: string, ctx: RosterContext): RosterResult {
  const entry = find(entries, memberId);
  if (!isActive(entry)) throw new RosterError("not_in");
  const next = replace(entries, {
    ...strip(entry),
    state: "out",
    outReason: "removed",
    outAt: ctx.now,
  });
  return settle(entries, next, [{ type: "removed", memberId }], ctx);
}

/** Offers whose time ran out move on to the next reserve. */
export function expireOffers(entries: Entry[], ctx: RosterContext): RosterResult {
  const events: RosterEvent[] = [];
  let next = entries;
  for (const e of entries) {
    if (e.state === "offered" && e.offerExpiresAt !== undefined && e.offerExpiresAt <= ctx.now) {
      next = replace(next, { ...strip(e), state: "out", outReason: "expired", outAt: ctx.now });
      events.push({ type: "expired", memberId: e.memberId });
    }
  }
  return settle(entries, next, events, ctx);
}

/** Earliest pending offer deadline, so the scheduler knows when to look again. */
export function nextOfferExpiry(entries: Entry[]): number | null {
  let min: number | null = null;
  for (const e of entries) {
    if (e.state === "offered" && e.offerExpiresAt !== undefined) {
      min = min === null ? e.offerExpiresAt : Math.min(min, e.offerExpiresAt);
    }
  }
  return min;
}

/**
 * When a reserve offered a spot at `now` must answer by. Time inside quiet
 * hours (overnight) does not count, and no offer outlives kick-off.
 */
export function offerExpiry(ctx: RosterContext): number {
  const { now, kickoffAt, rules } = ctx;
  const minutes = sameLocalDay(now, kickoffAt, rules.timeZone)
    ? rules.matchDayConfirmWindowMinutes
    : rules.confirmWindowMinutes;
  let remaining = minutes * MINUTE;
  let t = now;
  if (rules.quietHours) {
    for (let i = 0; i < 8 && remaining > 0; i++) {
      const quiet = quietSpanAt(t, rules.quietHours, rules.timeZone);
      if (quiet) {
        t = quiet.end;
        continue;
      }
      const nextStart = nextQuietStart(t, rules.quietHours, rules.timeZone);
      if (t + remaining <= nextStart) break;
      remaining -= nextStart - t;
      t = nextStart;
    }
  }
  return Math.min(t + remaining, kickoffAt);
}

// ---------------------------------------------------------------------------

/**
 * Bring the roster back to a consistent state after a change: reserves that
 * now sit inside the squad get an offer, and anyone pushed outside it (if the
 * squad size shrank) goes back to waiting.
 */
function settle(
  before: Entry[],
  entries: Entry[],
  events: RosterEvent[],
  ctx: RosterContext,
): RosterResult {
  const active = entries.filter(isActive).sort(bySeq);
  const gameOn = ctx.now < ctx.kickoffAt;
  let next = entries;
  active.forEach((e, i) => {
    const inSquad = i < ctx.rules.squadSize;
    if (inSquad && e.state === "waiting" && gameOn) {
      const expiresAt = offerExpiry(ctx);
      next = replace(next, { ...e, state: "offered", offerExpiresAt: expiresAt });
      events.push({ type: "offered", memberId: e.memberId, expiresAt });
    } else if (!inSquad && (e.state === "confirmed" || e.state === "offered")) {
      if (e.state === "offered") events.push({ type: "offer_withdrawn", memberId: e.memberId });
      next = replace(next, { ...strip(e), state: "waiting" });
    }
  });
  const changed = next
    .filter((e) => {
      const old = before.find((b) => b.memberId === e.memberId);
      return !old || JSON.stringify(old) !== JSON.stringify(e);
    })
    .map((e) => e.memberId);
  return { entries: next, changed, events };
}

function find(entries: Entry[], memberId: string): Entry {
  const e = entries.find((x) => x.memberId === memberId);
  if (!e) throw new RosterError("not_in");
  return e;
}

function replace(entries: Entry[], entry: Entry): Entry[] {
  return entries.map((e) => (e.memberId === entry.memberId ? entry : e));
}

/** Drop the per-state fields so a state change starts clean. */
function strip(e: Entry): Entry {
  const { offerExpiresAt: _o, outReason: _r, outAt: _a, lateDropOut: _l, ...rest } = e;
  return rest;
}

function quietSpanAt(
  t: number,
  q: QuietHours,
  timeZone: string,
): { end: number } | null {
  const p = localParts(t, timeZone);
  const now = p.hour * 60 + p.minute;
  const start = minuteOfDay(parseClock(q.start));
  const end = minuteOfDay(parseClock(q.end));
  const inside = start <= end ? now >= start && now < end : now >= start || now < end;
  if (!inside) return null;
  const today = { year: p.year, month: p.month, day: p.day };
  let endAt = zonedToEpoch(today, parseClock(q.end), timeZone);
  if (endAt <= t) endAt = zonedToEpoch(addDays(today, 1), parseClock(q.end), timeZone);
  return { end: endAt };
}

function nextQuietStart(t: number, q: QuietHours, timeZone: string): number {
  const p = localParts(t, timeZone);
  const today = { year: p.year, month: p.month, day: p.day };
  const startToday = zonedToEpoch(today, parseClock(q.start), timeZone);
  return startToday > t ? startToday : zonedToEpoch(addDays(today, 1), parseClock(q.start), timeZone);
}

