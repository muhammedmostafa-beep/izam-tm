import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { BASE_KITS, DEFAULT_KITS, normalizeKit, normalizeKits } from "../src/domain/kits";
import { validateTeams } from "../src/domain/teams";

describe("kits", () => {
  it("plays in red, black and white unless the group says otherwise", () => {
    assert.deepEqual(DEFAULT_KITS.map((k) => k.name), ["Red", "Black", "White"]);
  });

  it("uses the standard name and color for red, black and white", () => {
    assert.deepEqual(normalizeKit({ color: "red", name: "Reds", hex: "#000000" }), BASE_KITS.red);
  });

  it("needs a name and the actual color for any other kit", () => {
    assert.deepEqual(normalizeKit({ color: "other", name: " Blue ", hex: "#1e88e5" }), { color: "other", name: "Blue", hex: "#1E88E5" });
    assert.throws(() => normalizeKit({ color: "other", hex: "#1e88e5" }), /name/);
    assert.throws(() => normalizeKit({ color: "other", name: "Blue" }), /#RRGGBB/);
    assert.throws(() => normalizeKit({ color: "blue", name: "Blue", hex: "#1e88e5" }), /red, black, white or other/);
  });

  it("takes 2 to 6 kits with different names", () => {
    assert.throws(() => normalizeKits([BASE_KITS.red]), /2 to 6/);
    assert.throws(() => normalizeKits([BASE_KITS.red, { color: "red" }]), /same name/);
    assert.throws(() => normalizeKits([BASE_KITS.red, { color: "other", name: "red", hex: "#FF0000" }]), /same name/);
    assert.equal(normalizeKits([...DEFAULT_KITS, { color: "other", name: "Blue", hex: "#1E88E5" }]).length, 4);
  });
});

describe("teams", () => {
  const members = new Set(["a", "b", "c", "d"]);

  it("accepts a split of group members into kits", () => {
    const teams = validateTeams(
      [
        { kit: { color: "red" }, memberIds: ["a", "b"] },
        { kit: { color: "other", name: "Blue", hex: "#1e88e5" }, memberIds: ["c"] },
      ],
      members,
    );
    assert.deepEqual(teams, [
      { kit: BASE_KITS.red, memberIds: ["a", "b"] },
      { kit: { color: "other", name: "Blue", hex: "#1E88E5" }, memberIds: ["c"] },
    ]);
  });

  it("refuses a player on two teams, strangers and a single team", () => {
    const red = { color: "red" };
    const black = { color: "black" };
    assert.throws(() => validateTeams([{ kit: red, memberIds: ["a"] }, { kit: black, memberIds: ["a"] }], members), /two teams/);
    assert.throws(() => validateTeams([{ kit: red, memberIds: ["z"] }, { kit: black, memberIds: [] }], members), /isn't in the group/);
    assert.throws(() => validateTeams([{ kit: red, memberIds: ["a"] }], members), /2 to 6/);
  });
});
