import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { addDays, HOUR, isoWeekday, localParts, parseClock, zonedToEpoch } from "../src/domain/time";
import { currentKickoff, gameIdFor, pollOpensAt, validateSchedule, WeeklySchedule } from "../src/domain/schedule";

const CAIRO = "Africa/Cairo";

describe("time zones", () => {
  it("converts Cairo summer time (UTC+3) and winter time (UTC+2)", () => {
    // Egypt runs summer time from the last Friday of April to the last Thursday of October.
    const summer = zonedToEpoch({ year: 2026, month: 10, day: 22 }, { hour: 21, minute: 0 }, CAIRO);
    assert.equal(new Date(summer).toISOString(), "2026-10-22T18:00:00.000Z");
    const winter = zonedToEpoch({ year: 2026, month: 11, day: 5 }, { hour: 21, minute: 0 }, CAIRO);
    assert.equal(new Date(winter).toISOString(), "2026-11-05T19:00:00.000Z");
  });

  it("round-trips local parts", () => {
    const t = zonedToEpoch({ year: 2027, month: 1, day: 3 }, { hour: 12, minute: 0 }, CAIRO);
    const p = localParts(t, CAIRO);
    assert.deepEqual(
      { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute, wd: p.weekday },
      { y: 2027, m: 1, d: 3, h: 12, min: 0, wd: 7 },
    );
  });

  it("does date arithmetic across month and year ends", () => {
    assert.deepEqual(addDays({ year: 2026, month: 12, day: 30 }, 3), { year: 2027, month: 1, day: 2 });
    assert.equal(isoWeekday({ year: 2026, month: 10, day: 15 }), 4); // a Thursday
  });

  it("rejects malformed clock times", () => {
    assert.throws(() => parseClock("9:00"));
    assert.throws(() => parseClock("24:00"));
    assert.deepEqual(parseClock("09:05"), { hour: 9, minute: 5 });
  });
});

describe("weekly schedule", () => {
  const thursdays: WeeklySchedule = {
    timeZone: CAIRO,
    matchWeekday: 4,
    matchTime: "21:00",
    matchDurationMinutes: 90,
    pollOpenWeekday: 7,
    pollOpenTime: "12:00",
  };
  const at = (iso: string) => Date.parse(iso);

  it("finds this week's Thursday game", () => {
    const kickoff = currentKickoff(at("2026-10-18T10:00:00Z"), thursdays); // Sunday
    assert.equal(new Date(kickoff).toISOString(), "2026-10-22T18:00:00.000Z");
    assert.equal(gameIdFor(kickoff, CAIRO), "2026-10-22");
  });

  it("keeps the game current while it is being played, then moves on", () => {
    const during = currentKickoff(at("2026-10-22T19:00:00Z"), thursdays); // 22:00 Cairo
    assert.equal(gameIdFor(during, CAIRO), "2026-10-22");
    const after = currentKickoff(at("2026-10-22T19:31:00Z"), thursdays); // 22:31 Cairo
    assert.equal(gameIdFor(after, CAIRO), "2026-10-29");
  });

  it("opens the poll on the Sunday before kick-off", () => {
    const kickoff = at("2026-10-22T18:00:00Z");
    assert.equal(new Date(pollOpensAt(kickoff, thursdays)).toISOString(), "2026-10-18T09:00:00.000Z");
  });

  it("handles a poll that opens on match day", () => {
    const sameDay = { ...thursdays, pollOpenWeekday: 4, pollOpenTime: "10:00" };
    const kickoff = at("2026-10-22T18:00:00Z");
    assert.equal(pollOpensAt(kickoff, sameDay) - kickoff, -11 * HOUR);
  });

  it("validates settings", () => {
    assert.equal(validateSchedule(thursdays), null);
    assert.match(validateSchedule({ ...thursdays, matchWeekday: 0 }) ?? "", /matchWeekday/);
    assert.match(validateSchedule({ ...thursdays, timeZone: "Mars/Olympus" }) ?? "", /time zone/i);
  });
});
