// Firestore security rules, run against the emulator with `npm run test:emulator`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc, updateDoc } from "firebase/firestore";

let env: RulesTestEnvironment;

before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-tashkeela-rules",
    firestore: { host, port: Number(port), rules: readFileSync(resolve(__dirname, "../../../firestore.rules"), "utf8") },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "groups/g1"), { name: "TNF", memberUids: ["alice", "org"], adminUids: ["org"] });
    await setDoc(doc(db, "groups/g1/members/m1"), { name: "Alice", uid: "alice" });
    await setDoc(doc(db, "groups/g1/games/2026-10-22"), { status: "open" });
    await setDoc(doc(db, "groups/g1/games/2026-10-22/entries/m1"), { state: "confirmed", seq: 1 });
    await setDoc(doc(db, "users/alice"), { phone: "+20100", groupIds: ["g1"], pushIds: [] });
  });
});

after(async () => {
  await env.cleanup();
});

describe("security rules", () => {
  it("lets members read their group, its games and the list", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertSucceeds(getDoc(doc(db, "groups/g1")));
    await assertSucceeds(getDocs(collection(db, "groups/g1/members")));
    await assertSucceeds(getDocs(collection(db, "groups/g1/games/2026-10-22/entries")));
  });

  it("keeps everyone else out", async () => {
    const stranger = env.authenticatedContext("mallory").firestore();
    await assertFails(getDoc(doc(stranger, "groups/g1")));
    await assertFails(getDocs(collection(stranger, "groups/g1/members")));
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, "groups/g1/games/2026-10-22")));
  });

  it("never lets the app change the list directly, even for organizers", async () => {
    for (const uid of ["alice", "org"]) {
      const db = env.authenticatedContext(uid).firestore();
      await assertFails(setDoc(doc(db, "groups/g1/games/2026-10-22/entries/m9"), { state: "confirmed", seq: 0 }));
      await assertFails(updateDoc(doc(db, "groups/g1/games/2026-10-22/entries/m1"), { seq: 0 }));
      await assertFails(deleteDoc(doc(db, "groups/g1/games/2026-10-22/entries/m1")));
      await assertFails(updateDoc(doc(db, "groups/g1"), { adminUids: [uid] }));
    }
  });

  it("lets people manage only their own push IDs and language", async () => {
    const alice = env.authenticatedContext("alice").firestore();
    await assertSucceeds(updateDoc(doc(alice, "users/alice"), { pushIds: ["t1"], language: "en" }));
    await assertFails(updateDoc(doc(alice, "users/alice"), { groupIds: ["g1", "g2"] }));
    await assertFails(getDoc(doc(alice, "users/org")));
    const bob = env.authenticatedContext("bob").firestore();
    await assertSucceeds(setDoc(doc(bob, "users/bob"), { pushIds: ["t2"] }));
    await assertFails(setDoc(doc(bob, "users/bob2"), { pushIds: ["t2"] }));
  });
});
