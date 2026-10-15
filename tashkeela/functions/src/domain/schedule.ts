import {
  addDays,
  dateKey,
  isoWeekday,
  localDateOf,
  MINUTE,
  parseClock,
  zonedToEpoch,
} from "./time";

/** When the weekly game happens and when its poll opens, in the group's zone. */
export interface WeeklySchedule {
  timeZone: string;
  matchWeekday: number; // ISO 1-7
  matchTime: string; // "HH:mm"
  matchDurationMinutes: number;
  pollOpenWeekday: number; // ISO 1-7
  pollOpenTime: string; // "HH:mm"
}

/**
 * Kick-off of the game that is current at `now`: the earliest weekly game that
 * has not finished yet. While a game is being played it is still current.
 */
export function currentKickoff(now: number, s: WeeklySchedule): number {
  const today = localDateOf(now, s.timeZone);
  const clock = parseClock(s.matchTime);
  for (let k = -1; k <= 7; k++) {
    const date = addDays(today, k);
    if (isoWeekday(date) !== s.matchWeekday) continue;
    const kickoff = zonedToEpoch(date, clock, s.timeZone);
    if (kickoff + s.matchDurationMinutes * MINUTE > now) return kickoff;
  }
  throw new Error("No kick-off found within a week; check matchWeekday");
}

/** The poll for a game opens at the last poll-opening slot before kick-off. */
export function pollOpensAt(kickoffAt: number, s: WeeklySchedule): number {
  const kickoffDate = localDateOf(kickoffAt, s.timeZone);
  const clock = parseClock(s.pollOpenTime);
  for (let k = 0; k <= 7; k++) {
    const date = addDays(kickoffDate, -k);
    if (isoWeekday(date) !== s.pollOpenWeekday) continue;
    const opens = zonedToEpoch(date, clock, s.timeZone);
    if (opens < kickoffAt) return opens;
  }
  throw new Error("No poll opening found within a week; check pollOpenWeekday");
}

/** Games are keyed by their local kick-off date, e.g. "2026-10-22". */
export function gameIdFor(kickoffAt: number, timeZone: string): string {
  return dateKey(localDateOf(kickoffAt, timeZone));
}

export function validateSchedule(s: WeeklySchedule): string | null {
  const weekday = (n: number) => Number.isInteger(n) && n >= 1 && n <= 7;
  if (!weekday(s.matchWeekday)) return "matchWeekday must be 1 (Mon) to 7 (Sun)";
  if (!weekday(s.pollOpenWeekday)) return "pollOpenWeekday must be 1 (Mon) to 7 (Sun)";
  try {
    parseClock(s.matchTime);
    parseClock(s.pollOpenTime);
    new Intl.DateTimeFormat("en-US", { timeZone: s.timeZone });
  } catch (e) {
    return (e as Error).message;
  }
  if (!(s.matchDurationMinutes >= 30 && s.matchDurationMinutes <= 300)) {
    return "matchDurationMinutes must be between 30 and 300";
  }
  return null;
}
