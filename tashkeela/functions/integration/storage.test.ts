// Storage security rules for champions photos, run against the emulator with `npm run test:emulator`.
// The rules read the group from Firestore, and the Storage emulator looks it up under the project
// the emulators were started with, so this file seeds that project.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { getMetadata, ref, uploadBytes } from "firebase/storage";

let env: RulesTestEnvironment;
const photo = "groups/g1/champions/week-12.png";
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

before(async () => {
  const hostPort = (v: string | undefined, fallback: string) => {
    const [host, port] = (v ?? fallback).split(":");
    return { host, port: Number(port) };
  };
  env = await initializeTestEnvironment({
    projectId: "demo-tashkeela",
    firestore: {
      ...hostPort(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080"),
      rules: readFileSync(resolve(__dirname, "../../../firestore.rules"), "utf8"),
    },
    storage: {
      ...hostPort(process.env.FIREBASE_STORAGE_EMULATOR_HOST, "127.0.0.1:9199"),
      rules: readFileSync(resolve(__dirname, "../../../storage.rules"), "utf8"),
    },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "groups/g1"), { name: "TNF", memberUids: ["alice", "org"], adminUids: ["org"] });
  });
});

after(async () => {
  await env.cleanup();
});

describe("champions photo rules", () => {
  it("lets only organizers upload, and only images", async () => {
    const org = env.authenticatedContext("org").storage();
    await assertSucceeds(uploadBytes(ref(org, photo), png, { contentType: "image/png" }));
    await assertFails(uploadBytes(ref(org, "groups/g1/champions/notes.txt"), png, { contentType: "text/plain" }));
    const alice = env.authenticatedContext("alice").storage();
    await assertFails(uploadBytes(ref(alice, photo), png, { contentType: "image/png" }));
  });

  it("shows the photo to members only", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), photo), png, { contentType: "image/png" });
    });
    await assertSucceeds(getMetadata(ref(env.authenticatedContext("alice").storage(), photo)));
    await assertFails(getMetadata(ref(env.authenticatedContext("mallory").storage(), photo)));
    await assertFails(getMetadata(ref(env.unauthenticatedContext().storage(), photo)));
  });
});
