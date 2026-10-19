import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { tally } from "../src/domain/mvp";
import { share, splitFee, unpaid } from "../src/domain/payments";
import { join, PENALTY_SEQ, RosterContext, rosterView } from "../src/domain/roster";
import { seasonTable } from "../src/domain/stats";

describe("pitch fee", () => {
  it("splits the fee and rounds each share up to a whole pound", () => {
    assert.equal(share(2160, 18), 120);
    assert.equal(share(2000, 18), 112);
    assert.equal(share(500, 0), 0);
  });

  it("keeps who paid when the fee or the list changes", () => {
    const first = splitFee(1800, ["a", "b", "c"]);
    first.players.a = "paid";
    first.players.b = "claimed";
    const again = splitFee(2100, ["a", "b", "d"], first);
    assert.deepEqual(again, { fee: 2100, perPlayer: 700, players: { a: "paid", b: "claimed", d: "unpaid" } });
    assert.deepEqual(unpaid(again), ["d"]);
  });
});

describe("man of the match", () => {
  it("picks the most votes, and shares it on a tie", () => {
    assert.deepEqual(tally(["a", "b", "a", "c"]), { winners: ["a"], winnerVotes: 2 });
    assert.deepEqual(tally(["b", "a", "a", "b"]), { winners: ["a", "b"], winnerVotes: 2 });
    assert.deepEqual(tally([]), { winners: [], winnerVotes: 0 });
  });
});

describe("season table", () => {
  it("counts games played, wins, MVPs and drop-outs", () => {
    const table = seasonTable(
      [
        { squad: ["a", "b", "c"], winners: ["a", "b"], mvp: ["a"], dropOuts: ["d"], lateDropOuts: ["d"] },
        { squad: ["a", "c", "d"], winners: ["c", "d", "x"], mvp: [], dropOuts: ["b"], lateDropOuts: [] },
      ],
      { a: "Ahmed", b: "Bassem", c: "Karim", d: "Islam" },
    );
    assert.deepEqual(table.a, { name: "Ahmed", played: 2, wins: 1, mvp: 1, dropOuts: 0, lateDropOuts: 0 });
    assert.deepEqual(table.d, { name: "Islam", played: 1, wins: 1, mvp: 0, dropOuts: 1, lateDropOuts: 1 });
    // A winner who wasn't in the squad (moved after the game) doesn't count.
    assert.equal(table.x, undefined);
  });
});

describe("starting as a reserve", () => {
  const ctx: RosterContext = {
    now: Date.parse("2026-10-18T09:00:00Z"),
    kickoffAt: Date.parse("2026-10-22T18:00:00Z"),
    rules: { squadSize: 2, confirmWindowMinutes: 120, matchDayConfirmWindowMinutes: 30, lateDropOutHours: 24, quietHours: null, timeZone: "Africa/Cairo" },
  };

  it("puts a penalized player behind everyone who votes normally, even later", () => {
    let entries = join([], { memberId: "late", name: "Late" }, PENALTY_SEQ + 1, "app", ctx).entries;
    assert.equal(entries[0].state, "confirmed"); // a free spot is still a spot
    entries = join(entries, { memberId: "a", name: "A" }, 2, "app", ctx).entries;
    const r = join(entries, { memberId: "b", name: "B" }, 3, "app", ctx);
    assert.deepEqual(rosterView(r.entries, 2).squad.map((e) => e.memberId), ["a", "b"]);
    assert.deepEqual(rosterView(r.entries, 2).reserves.map((e) => e.memberId), ["late"]);
    assert.deepEqual(r.events[0], { type: "joined", memberId: "b", position: 2, inSquad: true });
  });
});
