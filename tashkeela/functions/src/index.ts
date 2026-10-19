import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import * as logger from "firebase-functions/logger";
import { defineSecret, defineString } from "firebase-functions/params";
import { CallableRequest, HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { asAppError, AppErrorCode, invalid } from "./core/errors";
import * as account from "./core/account";
import * as groups from "./core/groups";
import * as payments from "./core/payments";
import * as season from "./core/season";
import * as polls from "./core/polls";
import * as squad from "./core/squad";
import { applyRosterAction, RosterAction } from "./core/roster-ops";
import { tickGroup } from "./core/tick";
import { dispatch, Senders } from "./notify/dispatch";
import { handleInbound, parseInbound, verifySignature } from "./notify/inbound";
import { CloudApiWhatsApp, FcmPushSender } from "./notify/senders";

initializeApp();
const db = getFirestore();

// Close to Egypt; keep Firestore in a European location too (see README).
setGlobalOptions({ region: "europe-west1", maxInstances: 5 });

// WhatsApp stays off until WHATSAPP_PHONE_NUMBER_ID is set (see README).
const waToken = defineSecret("WHATSAPP_TOKEN");
const waAppSecret = defineSecret("WHATSAPP_APP_SECRET");
const waVerifyToken = defineSecret("WHATSAPP_VERIFY_TOKEN");
const waPhoneNumberId = defineString("WHATSAPP_PHONE_NUMBER_ID", { default: "" });
const waApiVersion = defineString("WHATSAPP_API_VERSION", { default: "v23.0" });
const waApiBase = defineString("WHATSAPP_API_BASE", { default: "https://graph.facebook.com" });
const appUrl = defineString("APP_URL", { default: "" });
const secrets = [waToken, waAppSecret, waVerifyToken];

function senders(): Senders {
  const phoneNumberId = waPhoneNumberId.value();
  return {
    push: new FcmPushSender(),
    whatsapp: phoneNumberId
      ? new CloudApiWhatsApp({
          token: waToken.value(),
          phoneNumberId,
          apiVersion: waApiVersion.value(),
          baseUrl: waApiBase.value(),
        })
      : null,
  };
}

const ERROR_STATUS: Partial<Record<AppErrorCode, "unauthenticated" | "permission-denied" | "not-found" | "invalid-argument" | "already-exists">> = {
  unauthenticated: "unauthenticated",
  permission_denied: "permission-denied",
  not_found: "not-found",
  not_member: "permission-denied",
  invalid: "invalid-argument",
  already_exists: "already-exists",
};

/** Wrap a callable: require sign-in and turn expected failures into HttpsErrors the app can read. */
function callable<T>(handler: (req: CallableRequest<any>, auth: { uid: string; phone: string }) => Promise<T>) {
  return onCall({ secrets }, async (req) => {
    const uid = req.auth?.uid;
    const phone = req.auth?.token.phone_number as string | undefined;
    if (!uid || !phone) throw new HttpsError("unauthenticated", "Sign in with your phone number first.");
    try {
      return await handler(req, { uid, phone });
    } catch (e) {
      const appError = asAppError(e);
      if (!appError) {
        logger.error("callable failed", e);
        throw new HttpsError("internal", "Something went wrong.");
      }
      throw new HttpsError(ERROR_STATUS[appError.code] ?? "failed-precondition", appError.message, { code: appError.code });
    }
  });
}

const str = (v: unknown, field: string): string => {
  if (typeof v !== "string" || !v) throw invalid(`${field} is required`);
  return v;
};

const uidByPhone = async (phone: string) => {
  try {
    return (await getAuth().getUserByPhoneNumber(phone)).uid;
  } catch {
    return null;
  }
};

// --- Groups and members ------------------------------------------------------

export const claimMemberships = callable((_req, a) => groups.claimMemberships(db, a));

export const createGroup = callable((req, a) =>
  groups.createGroup(db, {
    uid: a.uid,
    phone: a.phone,
    organizerName: req.data?.organizerName,
    name: req.data?.name,
    venue: req.data?.venue,
    language: req.data?.language,
    now: Date.now(),
  }),
);

export const updateGroupSettings = callable((req, a) =>
  groups.updateSettings(db, {
    groupId: str(req.data?.groupId, "groupId"),
    uid: a.uid,
    patch: req.data?.patch ?? {},
    now: Date.now(),
  }),
);

export const addMember = callable((req, a) =>
  groups.addMember(db, uidByPhone, {
    groupId: str(req.data?.groupId, "groupId"),
    uid: a.uid,
    name: req.data?.name,
    phone: req.data?.phone,
    isGoalkeeper: req.data?.isGoalkeeper,
    language: req.data?.language,
    now: Date.now(),
  }),
);

export const updateMember = callable((req, a) =>
  groups.updateMember(db, {
    groupId: str(req.data?.groupId, "groupId"),
    uid: a.uid,
    memberId: str(req.data?.memberId, "memberId"),
    name: req.data?.name,
    role: req.data?.role,
    isGoalkeeper: req.data?.isGoalkeeper,
    isRegular: req.data?.isRegular,
  }),
);

export const removeMember = callable(async (req, a) => {
  const notices = await groups.removeMember(db, {
    groupId: str(req.data?.groupId, "groupId"),
    uid: a.uid,
    memberId: str(req.data?.memberId, "memberId"),
    now: Date.now(),
  });
  await dispatch(db, notices, senders());
});

export const updateMyPreferences = callable((req, a) =>
  groups.updateMyPreferences(db, {
    groupId: str(req.data?.groupId, "groupId"),
    uid: a.uid,
    whatsappOptIn: req.data?.whatsappOptIn,
    language: req.data?.language,
  }),
);

// --- The weekly game ---------------------------------------------------------

const SELF_ACTIONS: RosterAction[] = ["join", "drop", "confirm", "pass"];
const ADMIN_ACTIONS: RosterAction[] = ["join", "remove"];

/** A player acts on their own spot: join, drop, confirm or pass. */
export const rosterAction = callable(async (req, a) => {
  const groupId = str(req.data?.groupId, "groupId");
  const gameId = str(req.data?.gameId, "gameId");
  const action = req.data?.action as RosterAction;
  if (!SELF_ACTIONS.includes(action)) throw invalid("unknown action");
  const { memberId } = await groups.memberForUid(db, groupId, a.uid);
  const r = await applyRosterAction(db, { groupId, gameId, memberId, action, source: "app", actorUid: a.uid, now: Date.now() });
  await dispatch(db, r.notices, senders());
  return { state: r.entry?.state ?? null, position: r.position, squadSize: r.squadSize };
});

/** The organizer adds someone who asked by phone, or takes someone off the list. */
export const adminRosterAction = callable(async (req, a) => {
  const groupId = str(req.data?.groupId, "groupId");
  const gameId = str(req.data?.gameId, "gameId");
  const memberId = str(req.data?.memberId, "memberId");
  const action = req.data?.action as RosterAction;
  if (!ADMIN_ACTIONS.includes(action)) throw invalid("unknown action");
  groups.requireAdmin(await groups.loadGroup(db, groupId), a.uid);
  const r = await applyRosterAction(db, { groupId, gameId, memberId, action, source: "admin", actorUid: a.uid, now: Date.now() });
  await dispatch(db, r.notices, senders());
  return { state: r.entry?.state ?? null, position: r.position };
});

export const openPollNow = callable(async (req, a) => {
  const groupId = str(req.data?.groupId, "groupId");
  const gameId = typeof req.data?.gameId === "string" ? req.data.gameId : null;
  const r = await groups.openPollNow(db, { groupId, uid: a.uid, gameId, now: Date.now() });
  await dispatch(db, await tickGroup(db, groupId, Date.now()), senders());
  return r;
});

export const recordResult = callable(async (req, a) => {
  const groupId = str(req.data?.groupId, "groupId");
  await groups.recordResult(db, {
    groupId,
    uid: a.uid,
    gameId: str(req.data?.gameId, "gameId"),
    winner: req.data?.winner,
    photoPath: req.data?.photoPath,
    now: Date.now(),
  });
  await season.rebuildSeasonStats(db, groupId, Date.now());
});

// --- Polls the organizer makes ------------------------------------------------

const pollFields = (d: Record<string, unknown> | undefined) => ({
  kickoffAt: d?.kickoffAt,
  durationMinutes: d?.durationMinutes,
  venue: d?.venue,
  squadSize: d?.squadSize,
  pollOpensAt: d?.pollOpensAt,
});

export const createPoll = callable(async (req, a) => {
  const groupId = str(req.data?.groupId, "groupId");
  const r = await polls.createPoll(db, { ...pollFields(req.data), groupId, uid: a.uid, now: Date.now() });
  // Opens at once if voting starts now, and tells everyone.
  await dispatch(db, await tickGroup(db, groupId, Date.now()), senders());
  return r;
});

export const updatePoll = callable(async (req, a) => {
  const groupId = str(req.data?.groupId, "groupId");
  const notices = await polls.updatePoll(db, {
    ...pollFields(req.data),
    groupId,
    uid: a.uid,
    gameId: str(req.data?.gameId, "gameId"),
    now: Date.now(),
  });
  await dispatch(db, [...notices, ...(await tickGroup(db, groupId, Date.now()))], senders());
});

export const cancelPoll = callable(async (req, a) => {
  const notices = await polls.cancelPoll(db, {
    groupId: str(req.data?.groupId, "groupId"),
    uid: a.uid,
    gameId: str(req.data?.gameId, "gameId"),
    now: Date.now(),
  });
  await dispatch(db, notices, senders());
});

// --- Levels and teams (organizers) ---------------------------------------------

export const setMemberLevel = callable((req, a) =>
  squad.setMemberLevel(db, {
    groupId: str(req.data?.groupId, "groupId"),
    uid: a.uid,
    memberId: str(req.data?.memberId, "memberId"),
    level: req.data?.level,
    now: Date.now(),
  }),
);

export const saveTeams = callable(async (req, a) => {
  const groupId = str(req.data?.groupId, "groupId");
  await squad.saveTeams(db, {
    groupId,
    uid: a.uid,
    gameId: str(req.data?.gameId, "gameId"),
    teams: req.data?.teams ?? null,
    now: Date.now(),
  });
});

// --- Paying the pitch ----------------------------------------------------------

const gameInput = (req: CallableRequest<any>, uid: string) => ({
  groupId: str(req.data?.groupId, "groupId"),
  uid,
  gameId: str(req.data?.gameId, "gameId"),
  now: Date.now(),
});

export const setGameFee = callable((req, a) => payments.setGameFee(db, { ...gameInput(req, a.uid), fee: req.data?.fee ?? null }));

export const setPayment = callable((req, a) =>
  payments.setPayment(db, { ...gameInput(req, a.uid), memberId: str(req.data?.memberId, "memberId"), state: req.data?.state }),
);

export const claimPayment = callable((req, a) => payments.claimPayment(db, gameInput(req, a.uid)));

export const remindUnpaid = callable(async (req, a) => {
  const r = await payments.remindUnpaid(db, gameInput(req, a.uid));
  await dispatch(db, r.notices, senders());
  return { reminded: r.reminded };
});

// --- Man of the match and the season table --------------------------------------

export const voteMvp = callable((req, a) => season.voteMvp(db, { ...gameInput(req, a.uid), choice: req.data?.choice }));

export const closeMvpVoting = callable((req, a) => season.closeMvpNow(db, gameInput(req, a.uid)));

export const startSeason = callable((req, a) =>
  season.startSeason(db, { groupId: str(req.data?.groupId, "groupId"), uid: a.uid, name: req.data?.name, now: Date.now() }),
);

// --- Leaving, and deleting your data ---------------------------------------------

export const leaveGroup = callable(async (req, a) => {
  const notices = await account.leaveGroup(db, { groupId: str(req.data?.groupId, "groupId"), uid: a.uid, now: Date.now() });
  await dispatch(db, notices, senders());
});

export const deleteAccount = callable(async (_req, a) => {
  const notices = await account.deleteAccount(db, { uid: a.uid, now: Date.now() });
  await dispatch(db, notices, senders());
  await getAuth().deleteUser(a.uid);
});

// --- Scheduler and WhatsApp webhook -------------------------------------------

/** Opens polls on the minute, expires offers and sends match-day reminders. */
export const tick = onSchedule(
  { schedule: "every 1 minutes", timeZone: "Africa/Cairo", secrets, retryCount: 0 },
  async () => {
    const now = Date.now();
    const all = await db.collection("groups").select().get();
    const s = senders();
    for (const g of all.docs) {
      try {
        await dispatch(db, await tickGroup(db, g.id, now), s);
      } catch (e) {
        logger.error("tick failed", { groupId: g.id, error: (e as Error).message });
      }
    }
  },
);

/** Meta calls this URL with button taps and messages (see README). */
export const whatsappWebhook = onRequest({ secrets }, async (req, res) => {
  if (req.method === "GET") {
    const ok = req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === waVerifyToken.value();
    if (ok) res.status(200).send(String(req.query["hub.challenge"] ?? ""));
    else res.sendStatus(403);
    return;
  }
  if (req.method !== "POST") {
    res.sendStatus(405);
    return;
  }
  if (!verifySignature(req.rawBody, req.header("x-hub-signature-256"), waAppSecret.value())) {
    res.sendStatus(401);
    return;
  }
  const s = senders();
  for (const msg of parseInbound(req.body)) {
    try {
      await handleInbound(db, msg, s, appUrl.value(), Date.now());
    } catch (e) {
      logger.error("whatsapp message failed", { id: msg.id, error: (e as Error).message });
    }
  }
  res.sendStatus(200);
});

