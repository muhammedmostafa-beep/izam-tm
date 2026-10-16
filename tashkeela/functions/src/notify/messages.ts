// Every text players see from the server, in Arabic and English.
// WhatsApp template bodies live in Meta's Business Manager; the names and
// parameter order here must match README.md ("WhatsApp templates").

import { AppErrorCode } from "../core/errors";
import { Language } from "../model";

export function formatWhen(ms: number, timeZone: string, lang: Language): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ms));
}

export function formatClock(ms: number, timeZone: string, lang: Language): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ms));
}

/** Counts and positions in the reader's digits (Arabic-Indic for Arabic), like the dates. */
export function formatNumber(n: number, lang: Language): string {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-GB").format(n);
}

export interface PushText {
  title: string;
  body: string;
}

const pick = <T>(lang: Language, ar: T, en: T): T => (lang === "ar" ? ar : en);

export const pushText = {
  pollOpen: (lang: Language, p: { group: string; when: string; spots: number }): PushText =>
    pick(
      lang,
      { title: `التصويت مفتوح: ${p.group}`, body: `${p.when} – ${formatNumber(p.spots, "ar")} مكان. اضغط عشان تحجز مكانك.` },
      { title: `Poll is open: ${p.group}`, body: `${p.when} · ${p.spots} spots. Tap to grab yours.` },
    ),
  offered: (lang: Language, p: { when: string; deadline: string }): PushText =>
    pick(
      lang,
      { title: "فيه مكان فضي ليك!", body: `ماتش ${p.when}. أكد قبل ${p.deadline} وإلا هيروح للي بعدك.` },
      { title: "A spot opened up for you!", body: `${p.when}. Confirm by ${p.deadline} or it goes to the next reserve.` },
    ),
  expired: (lang: Language): PushText =>
    pick(
      lang,
      { title: "انتهى وقت التأكيد", body: "المكان راح للاحتياطي اللي بعدك. تقدر تدخل الطابور تاني." },
      { title: "Your offer expired", body: "The spot went to the next reserve. You can rejoin the queue." },
    ),
  pollChanged: (lang: Language, p: { when: string; venue: string }): PushText =>
    pick(
      lang,
      { title: "الماتش اتغير", body: `المعاد الجديد ${p.when} في ${p.venue}. مكانك في القائمة زي ما هو.` },
      { title: "Game details changed", body: `Now ${p.when} at ${p.venue}. Your place on the list stays.` },
    ),
  pollCancelled: (lang: Language, p: { when: string }): PushText =>
    pick(
      lang,
      { title: "الماتش اتلغى", body: `ماتش ${p.when} اتلغى. هنبلغك بالماتش الجاي.` },
      { title: "Game called off", body: `The game on ${p.when} is cancelled. We'll let you know about the next one.` },
    ),
  matchDay: (lang: Language, p: { time: string; venue: string }): PushText =>
    pick(
      lang,
      { title: "النهارده الماتش!", body: `البداية ${p.time} في ${p.venue}.` },
      { title: "Match day!", body: `Kick-off ${p.time} at ${p.venue}.` },
    ),
  dropped: (lang: Language, p: { name: string; replacement: string | null; late: boolean }): PushText => {
    const late = p.late ? pick(lang, " (اعتذار متأخر)", " (late drop-out)") : "";
    return pick(
      lang,
      {
        title: `${p.name} اعتذر${late}`,
        body: p.replacement ? `اتعرض المكان على ${p.replacement}.` : "مفيش احتياطي، التشكيلة ناقصة واحد.",
      },
      {
        title: `${p.name} dropped out${late}`,
        body: p.replacement ? `${p.replacement} has been offered the spot.` : "No reserves left; the squad is one short.",
      },
    );
  },
};

export const replyText = {
  joinedSquad: (lang: Language, p: { position: number; squadSize: number; when: string }) =>
    pick(
      lang,
      `تمام، إنت جوه! رقم ${formatNumber(p.position, "ar")} من ${formatNumber(p.squadSize, "ar")} لماتش ${p.when}.`,
      `You're in! #${p.position} of ${p.squadSize} for ${p.when}.`,
    ),
  joinedReserve: (lang: Language, p: { reserve: number; when: string }) =>
    pick(
      lang,
      `التشكيلة كاملة، إنت احتياطي رقم ${formatNumber(p.reserve, "ar")} لماتش ${p.when}. هنبعتلك لو فضي مكان.`,
      `The squad is full; you're reserve #${p.reserve} for ${p.when}. We'll message you if a spot opens.`,
    ),
  confirmed: (lang: Language, p: { when: string }) =>
    pick(lang, `اتأكد مكانك في ماتش ${p.when}. نشوفك!`, `Spot confirmed for ${p.when}. See you there!`),
  passed: (lang: Language) =>
    pick(lang, "تمام، المكان راح للي بعدك.", "Done, the spot goes to the next reserve."),
  skipped: (lang: Language) => pick(lang, "تمام، نشوفك الأسبوع الجاي.", "Got it. See you next week."),
  error: (lang: Language, code: AppErrorCode) => {
    const ar: Partial<Record<AppErrorCode, string>> = {
      already_in: "إنت مسجل بالفعل في القائمة.",
      poll_not_open: "التصويت لسه ما فتحش.",
      game_closed: "التصويت اتقفل.",
      game_started: "الماتش بدأ خلاص.",
      no_offer: "مفيش مكان معروض عليك دلوقتي، يمكن الوقت خلص.",
      not_in: "إنت مش في القائمة.",
      not_member: "رقمك مش في الجروب ده. كلم المنظم.",
    };
    const en: Partial<Record<AppErrorCode, string>> = {
      already_in: "You're already on the list.",
      poll_not_open: "The poll isn't open yet.",
      game_closed: "The poll is closed.",
      game_started: "The game has already started.",
      no_offer: "There's no spot waiting for you; the offer may have expired.",
      not_in: "You're not on the list.",
      not_member: "Your number isn't in this group. Ask the organizer.",
    };
    return pick(lang, ar[code], en[code]) ?? pick(lang, "حصلت مشكلة، جرب تاني.", "Something went wrong; please try again.");
  },
  help: (appUrl: string) =>
    `تشكيلة: استخدم أزرار الرسائل أو افتح التطبيق.\nTashkeela: use the message buttons or open the app.${appUrl ? `\n${appUrl}` : ""}`,
};

/** Template names registered in WhatsApp Manager (one per language: ar, en). */
export const TEMPLATES = {
  pollOpen: "tashkeela_poll_open", // {{1}} when, {{2}} venue, {{3}} spots; buttons: I'm in / Not this week
  spotOffered: "tashkeela_spot_offered", // {{1}} when, {{2}} deadline; buttons: Confirm / Pass
  matchDay: "tashkeela_match_day", // {{1}} kick-off time, {{2}} venue, {{3}} squad size
} as const;

/** Quick-reply button payloads: "t1|ACTION|groupId|gameId". */
export type ButtonAction = "JOIN" | "SKIP" | "CONFIRM" | "PASS";

export function buttonPayload(action: ButtonAction, groupId: string, gameId: string): string {
  return `t1|${action}|${groupId}|${gameId}`;
}

export function parseButtonPayload(
  payload: string,
): { action: ButtonAction; groupId: string; gameId: string } | null {
  const m = /^t1\|(JOIN|SKIP|CONFIRM|PASS)\|([A-Za-z0-9]{1,40})\|(\d{4}-\d{2}-\d{2})$/.exec(payload);
  return m ? { action: m[1] as ButtonAction, groupId: m[2], gameId: m[3] } : null;
}
