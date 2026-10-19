import { strict as assert } from "node:assert";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { normalizePhone, toWaId } from "../src/core/phone";
import { buttonPayload, formatWhen, parseButtonPayload, pushText, replyText } from "../src/notify/messages";
import { parseInbound, verifySignature } from "../src/notify/inbound";
import { CloudApiWhatsApp } from "../src/notify/senders";

describe("phone numbers", () => {
  it("normalizes the ways people write Egyptian numbers", () => {
    assert.equal(normalizePhone("010 0123 4567", "20"), "+201001234567");
    assert.equal(normalizePhone("+20 100-123-4567", "20"), "+201001234567");
    assert.equal(normalizePhone("00201001234567", "20"), "+201001234567");
    assert.equal(normalizePhone("201001234567", "20"), "+201001234567");
    assert.equal(normalizePhone("12", "20"), null);
    assert.equal(toWaId("+201001234567"), "201001234567");
  });
});

describe("WhatsApp buttons", () => {
  it("round-trips button payloads and rejects anything else", () => {
    const p = buttonPayload("CONFIRM", "abc123", "2026-10-22");
    assert.deepEqual(parseButtonPayload(p), { action: "CONFIRM", groupId: "abc123", gameId: "2026-10-22" });
    assert.equal(parseButtonPayload("t1|DELETE|abc|2026-10-22"), null);
    assert.equal(parseButtonPayload("t1|JOIN|../x|2026-10-22"), null);
    // A poll the organizer made (Firestore auto ID).
    assert.deepEqual(parseButtonPayload(buttonPayload("JOIN", "abc123", "Xk3P9qLmN2vB7rT1sY0w")), {
      action: "JOIN",
      groupId: "abc123",
      gameId: "Xk3P9qLmN2vB7rT1sY0w",
    });
    assert.equal(parseButtonPayload("t1|JOIN|abc|../games"), null);
  });

  it("verifies Meta's signature", () => {
    const body = Buffer.from('{"entry":[]}');
    const sig = "sha256=" + createHmac("sha256", "s3cret").update(body).digest("hex");
    assert.equal(verifySignature(body, sig, "s3cret"), true);
    assert.equal(verifySignature(body, sig, "other"), false);
    assert.equal(verifySignature(body, undefined, "s3cret"), false);
    assert.equal(verifySignature(body, "sha256=abcd", "s3cret"), false);
  });

  it("reads template buttons, interactive buttons and text", () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { id: "m1", from: "201001234567", type: "button", button: { payload: "t1|JOIN|g|2026-10-22", text: "I'm in" } },
                  { id: "m2", from: "201001234567", type: "interactive", interactive: { button_reply: { id: "t1|PASS|g|2026-10-22" } } },
                  { id: "m3", from: "201001234567", type: "text", text: { body: "hi" } },
                ],
              },
            },
          ],
        },
      ],
    };
    assert.deepEqual(parseInbound(body), [
      { id: "m1", from: "201001234567", payload: "t1|JOIN|g|2026-10-22", text: null },
      { id: "m2", from: "201001234567", payload: "t1|PASS|g|2026-10-22", text: null },
      { id: "m3", from: "201001234567", payload: null, text: "hi" },
    ]);
    assert.deepEqual(parseInbound({ object: "whatsapp_business_account" }), []);
  });

  it("sends templates with quick-reply payloads to the Cloud API", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const wa = new CloudApiWhatsApp({ token: "tok", phoneNumberId: "123", apiVersion: "v23.0" }, fakeFetch);
    await wa.sendTemplate("201001234567", "tashkeela_poll_open", "ar", ["Thu", "Arena", "18"], ["p0", "p1"]);
    assert.equal(calls[0].url, "https://graph.facebook.com/v23.0/123/messages");
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer tok");
    const sent = JSON.parse(String(calls[0].init.body));
    assert.equal(sent.template.language.code, "ar");
    assert.deepEqual(sent.template.components[2], {
      type: "button",
      sub_type: "quick_reply",
      index: "1",
      parameters: [{ type: "payload", payload: "p1" }],
    });
  });

  it("can talk to a local stub instead of Meta", async () => {
    const urls: string[] = [];
    const fakeFetch = (async (url: string) => {
      urls.push(url);
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const wa = new CloudApiWhatsApp({ token: "t", phoneNumberId: "9", apiVersion: "v23.0", baseUrl: "http://127.0.0.1:5055" }, fakeFetch);
    await wa.sendText("1", "hi");
    assert.deepEqual(urls, ["http://127.0.0.1:5055/v23.0/9/messages"]);
  });

  it("surfaces API errors", async () => {
    const failing = (async () => new Response("bad token", { status: 401 })) as unknown as typeof fetch;
    const wa = new CloudApiWhatsApp({ token: "x", phoneNumberId: "1", apiVersion: "v23.0" }, failing);
    await assert.rejects(wa.sendText("1", "hi"), /401/);
  });
});

describe("message texts", () => {
  it("formats match times in Arabic and English", () => {
    const kickoff = Date.parse("2026-10-22T18:00:00Z");
    assert.match(formatWhen(kickoff, "Africa/Cairo", "en"), /Thu 22 Oct.*9:00\s?pm/i);
    assert.match(formatWhen(kickoff, "Africa/Cairo", "ar"), /الخميس/);
  });

  it("writes numbers in Arabic-Indic digits in Arabic texts", () => {
    const ar = replyText.joinedSquad("ar", { position: 16, squadSize: 18, when: "x" });
    assert.match(ar, /١٦ من ١٨/);
    assert.doesNotMatch(ar, /[0-9]/);
    assert.match(replyText.joinedReserve("ar", { reserve: 2, when: "x" }), /رقم ٢ /);
    assert.match(pushText.pollOpen("ar", { group: "g", when: "x", spots: 18 }).body, /١٨ مكان/);
    assert.match(replyText.joinedSquad("en", { position: 16, squadSize: 18, when: "x" }), /#16 of 18/);
  });

  it("explains every refusal in both languages", () => {
    for (const code of ["already_in", "poll_not_open", "game_closed", "no_offer", "not_member"] as const) {
      assert.ok(replyText.error("ar", code).length > 5);
      assert.ok(!replyText.error("en", code).startsWith("Something"));
    }
  });
});
