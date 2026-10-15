// Time-zone helpers built on Intl, so no date library is needed.
// All instants are epoch milliseconds; "local" means wall-clock time in a
// named IANA zone such as "Africa/Cairo" (which observes summer time).

export interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // ISO: 1 = Monday ... 7 = Sunday
}

export interface LocalDate {
  year: number;
  month: number;
  day: number;
}

export interface ClockTime {
  hour: number;
  minute: number;
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const WEEKDAYS: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function localParts(epochMs: number, timeZone: string): LocalParts {
  const parts: Record<string, string> = {};
  for (const p of formatterFor(timeZone).formatToParts(new Date(epochMs))) {
    parts[p.type] = p.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday],
  };
}

/** The instant at which the given wall-clock time occurs in `timeZone`. */
export function zonedToEpoch(date: LocalDate, time: ClockTime, timeZone: string): number {
  const wall = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute);
  let guess = wall;
  // Two passes settle the offset, including across a summer-time change.
  for (let i = 0; i < 2; i++) {
    const p = localParts(guess, timeZone);
    const seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += wall - seen;
  }
  return guess;
}

export function parseClock(hhmm: string): ClockTime {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) throw new Error(`Invalid time "${hhmm}", expected HH:mm`);
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function isoWeekday(date: LocalDate): number {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return d === 0 ? 7 : d;
}

export function localDateOf(epochMs: number, timeZone: string): LocalDate {
  const p = localParts(epochMs, timeZone);
  return { year: p.year, month: p.month, day: p.day };
}

export function sameLocalDay(a: number, b: number, timeZone: string): boolean {
  const x = localDateOf(a, timeZone);
  const y = localDateOf(b, timeZone);
  return x.year === y.year && x.month === y.month && x.day === y.day;
}

export function dateKey(date: LocalDate): string {
  const mm = String(date.month).padStart(2, "0");
  const dd = String(date.day).padStart(2, "0");
  return `${date.year}-${mm}-${dd}`;
}

export function minuteOfDay(t: ClockTime): number {
  return t.hour * 60 + t.minute;
}
