import { FieldValue, Firestore, Timestamp } from "firebase-admin/firestore";
import { KitError, normalizeKits } from "../domain/kits";
import { parseClock } from "../domain/time";
import { validateSchedule, WeeklySchedule } from "../domain/schedule";
import {
  DEFAULT_REMINDERS,
  DEFAULT_RULES,
  DEFAULT_SCHEDULE,
  GameDoc,
  GroupDoc,
  GroupReminders,
  GroupRules,
  Language,
  MemberDoc,
  Role,
} from "../model";
import { AppError, asAppError, invalid } from "./errors";
import { ACTIVE_STATUSES, ensureWeeklyGame, gameRef, groupRef, refreshCurrentGame } from "./games";
import { normalizePhone } from "./phone";
import { applyRosterAction } from "./roster-ops";
import { Notice } from "../notify/notices";

/** Looks up an existing sign-in by phone number, so new members link at once. */
export type UidByPhone = (phone: string) => Promise<string | null>;

const nonEmpty = (v: unknown, field: string, max = 80): string => {
  if (typeof v !== "string" || !v.trim()) throw invalid(`${field} is required`);
  if (v.trim().length > max) throw invalid(`${field} is too long`);
  return v.trim();
};

export async function loadGroup(db: Firestore, groupId: string): Promise<GroupDoc> {
  const snap = await groupRef(db, groupId).get();
  if (!snap.exists) throw new AppError("not_found", "group not found");
  return snap.data() as GroupDoc;
}

export function requireAdmin(group: GroupDoc, uid: string): void {
  if (!group.adminUids.includes(uid)) throw new AppError("permission_denied", "organizers only");
}

/** The caller's member record in a group. */
export async function memberForUid(
  db: Firestore,
  groupId: string,
  uid: string,
): Promise<{ memberId: string; member: MemberDoc }> {
  const q = await groupRef(db, groupId)
    .collection("members")
    .where("uid", "==", uid)
    .where("active", "==", true)
    .limit(1)
    .get();
  if (q.empty) throw new AppError("not_member");
  return { memberId: q.docs[0].id, member: q.docs[0].data() as MemberDoc };
}

export async function createGroup(
  db: Firestore,
  input: {
    uid: string;
    phone: string;
    organizerName: unknown;
    name: unknown;
    venue: unknown;
    language?: unknown;
    now: number;
  },
): Promise<{ groupId: string }> {
  const name = nonEmpty(input.name, "name");
  const venue = nonEmpty(input.venue, "venue");
  const organizerName = nonEmpty(input.organizerName, "organizerName", 40);
  const stamp = Timestamp.fromMillis(input.now);
  const ref = db.collection("groups").doc();
  const group: GroupDoc = {
    name,
    venue,
    countryCode: "20",
    schedule: DEFAULT_SCHEDULE,
    rules: DEFAULT_RULES,
    reminders: DEFAULT_REMINDERS,
    pitchFee: null,
    adminUids: [input.uid],
    memberUids: [input.uid],
    currentGameId: null,
    weekCounter: 0,
    lastChampions: null,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const member: MemberDoc = {
    name: organizerName,
    phone: input.phone,
    uid: input.uid,
    role: "admin",
    isGoalkeeper: false,
    whatsappOptIn: true,
    language: input.language === "en" ? "en" : "ar",
    active: true,
    createdAt: stamp,
  };
  const batch = db.batch();
  batch.set(ref, group);
  batch.set(ref.collection("members").doc(), member);
  batch.set(
    db.collection("users").doc(input.uid),
    { phone: input.phone, groupIds: FieldValue.arrayUnion(ref.id) },
    { merge: true },
  );
  await batch.commit();
  await ensureWeeklyGame(db, ref.id, input.now);
  await refreshCurrentGame(db, ref.id, input.now);
  return { groupId: ref.id };
}

export interface SettingsPatch {
  name?: unknown;
  venue?: unknown;
  pitchFee?: unknown;
  schedule?: Partial<WeeklySchedule>;
  rules?: Partial<GroupRules>;
  reminders?: Partial<GroupReminders>;
}

export function mergeSettings(group: GroupDoc, patch: SettingsPatch): Partial<GroupDoc> {
  const out: Partial<GroupDoc> = {};
  if (patch.name !== undefined) out.name = nonEmpty(patch.name, "name");
  if (patch.venue !== undefined) out.venue = nonEmpty(patch.venue, "venue");
  if (patch.pitchFee !== undefined) {
    const fee = patch.pitchFee;
    if (fee !== null && !(typeof fee === "number" && fee >= 0 && fee < 1_000_000)) {
      throw invalid("pitchFee must be a positive number");
    }
    out.pitchFee = fee as number | null;
  }
  if (patch.schedule) {
    const schedule = { ...group.schedule, ...pick(patch.schedule, Object.keys(DEFAULT_SCHEDULE)) };
    const problem = validateSchedule(schedule as WeeklySchedule);
    if (problem) throw invalid(problem);
    out.schedule = schedule as WeeklySchedule;
  }
  if (patch.rules) {
    const rules = { ...group.rules, ...pick(patch.rules, Object.keys(DEFAULT_RULES)) } as GroupRules;
    const int = (n: unknown, lo: number, hi: number) => Number.isInteger(n) && (n as number) >= lo && (n as number) <= hi;
    if (!int(rules.squadSize, 2, 60)) throw invalid("squadSize must be between 2 and 60");
    if (!int(rules.confirmWindowMinutes, 5, 24 * 60)) throw invalid("confirmWindowMinutes out of range");
    if (!int(rules.matchDayConfirmWindowMinutes, 5, 24 * 60)) throw invalid("matchDayConfirmWindowMinutes out of range");
    if (!int(rules.lateDropOutHours, 0, 168)) throw invalid("lateDropOutHours out of range");
    try {
      rules.kits = normalizeKits(rules.kits);
    } catch (e) {
      throw invalid((e as KitError).message);
    }
    if (rules.quietHours !== null) {
      try {
        parseClock(rules.quietHours.start);
        parseClock(rules.quietHours.end);
      } catch (e) {
        throw invalid((e as Error).message);
      }
    }
    out.rules = rules;
  }
  if (patch.reminders) {
    const reminders = { ...group.reminders, ...pick(patch.reminders, Object.keys(DEFAULT_REMINDERS)) } as GroupReminders;
    for (const k of ["pollOpening", "promotion", "matchDay"] as const) {
      if (typeof reminders[k] !== "boolean") throw invalid(`${k} must be true or false`);
    }
    if (!(Number.isInteger(reminders.matchDayHoursBefore) && reminders.matchDayHoursBefore >= 1 && reminders.matchDayHoursBefore <= 12)) {
      throw invalid("matchDayHoursBefore must be between 1 and 12");
    }
    out.reminders = reminders;
  }
  return out;
}

export async function updateSettings(
  db: Firestore,
  input: { groupId: string; uid: string; patch: SettingsPatch; now: number },
): Promise<void> {
  const group = await loadGroup(db, input.groupId);
  requireAdmin(group, input.uid);
  const changes = mergeSettings(group, input.patch);
  await groupRef(db, input.groupId).update({ ...changes, updatedAt: Timestamp.fromMillis(input.now) });

  const weekly = await groupRef(db, input.groupId)
    .collection("games")
    .where("kind", "==", "weekly")
    .where("status", "in", ACTIVE_STATUSES)
    .get();
  for (const doc of weekly.docs) {
    const game = doc.data() as GameDoc;
    // A new schedule (or turning the weekly poll off) replaces a weekly poll that hasn't opened yet.
    if (changes.schedule && game.status === "scheduled") {
      await doc.ref.delete();
      await groupRef(db, input.groupId).update({ weekCounter: FieldValue.increment(-1) });
      continue;
    }
    // A new place or squad size applies to this week's poll too.
    const venue = changes.venue !== undefined && changes.venue !== group.venue ? changes.venue : undefined;
    const squadSize =
      changes.rules && changes.rules.squadSize !== game.squadSize ? changes.rules.squadSize : undefined;
    if (venue === undefined && squadSize === undefined) continue;
    await doc.ref.update({ venue: venue ?? game.venue, squadSize: squadSize ?? game.squadSize });
    if (squadSize !== undefined && game.status === "open") {
      // Re-sort the list: reserves move up into a bigger squad, or the last in drop to reserves.
      await applyRosterAction(db, {
        groupId: input.groupId,
        gameId: doc.id,
        memberId: null,
        action: "expire",
        source: "admin",
        actorUid: input.uid,
        now: input.now,
      });
    }
  }
  await ensureWeeklyGame(db, input.groupId, input.now);
  await refreshCurrentGame(db, input.groupId, input.now);
}

export async function addMember(
  db: Firestore,
  uidByPhone: UidByPhone,
  input: {
    groupId: string;
    uid: string;
    name: unknown;
    phone: unknown;
    isGoalkeeper?: unknown;
    language?: unknown;
    now: number;
  },
): Promise<{ memberId: string; linked: boolean }> {
  const group = await loadGroup(db, input.groupId);
  requireAdmin(group, input.uid);
  const name = nonEmpty(input.name, "name", 40);
  const phone = normalizePhone(nonEmpty(input.phone, "phone", 20), group.countryCode);
  if (!phone) throw invalid("phone number is not valid");
  const members = groupRef(db, input.groupId).collection("members");
  const dup = await members.where("phone", "==", phone).limit(1).get();
  if (!dup.empty && (dup.docs[0].data() as MemberDoc).active) {
    throw new AppError("already_exists", "this number is already in the group");
  }

  const uid = await uidByPhone(phone).catch(() => null);
  const member: MemberDoc = {
    name,
    phone,
    uid,
    role: "player",
    isGoalkeeper: input.isGoalkeeper === true,
    whatsappOptIn: true,
    language: input.language === "en" ? "en" : "ar",
    active: true,
    createdAt: Timestamp.fromMillis(input.now),
  };
  const ref = dup.empty ? members.doc() : dup.docs[0].ref;
  const batch = db.batch();
  batch.set(ref, member);
  if (uid) {
    batch.update(groupRef(db, input.groupId), { memberUids: FieldValue.arrayUnion(uid) });
    batch.set(db.collection("users").doc(uid), { phone, groupIds: FieldValue.arrayUnion(input.groupId) }, { merge: true });
  }
  await batch.commit();
  return { memberId: ref.id, linked: uid !== null };
}

export async function updateMember(
  db: Firestore,
  input: {
    groupId: string;
    uid: string;
    memberId: string;
    name?: unknown;
    role?: unknown;
    isGoalkeeper?: unknown;
  },
): Promise<void> {
  const group = await loadGroup(db, input.groupId);
  requireAdmin(group, input.uid);
  const ref = groupRef(db, input.groupId).collection("members").doc(input.memberId);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError("not_found", "member not found");
  const member = snap.data() as MemberDoc;
  const changes: Partial<MemberDoc> = {};
  if (input.name !== undefined) changes.name = nonEmpty(input.name, "name", 40);
  if (input.isGoalkeeper !== undefined) changes.isGoalkeeper = input.isGoalkeeper === true;
  if (input.role !== undefined) {
    if (input.role !== "admin" && input.role !== "player") throw invalid("role must be admin or player");
    changes.role = input.role as Role;
  }
  const batch = db.batch();
  batch.update(ref, changes);
  if (changes.role && member.uid) {
    if (changes.role === "player" && group.adminUids.length === 1 && group.adminUids[0] === member.uid) {
      throw invalid("the group needs at least one organizer");
    }
    batch.update(groupRef(db, input.groupId), {
      adminUids: changes.role === "admin" ? FieldValue.arrayUnion(member.uid) : FieldValue.arrayRemove(member.uid),
    });
  }
  await batch.commit();
}

export async function removeMember(
  db: Firestore,
  input: { groupId: string; uid: string; memberId: string; now: number },
): Promise<Notice[]> {
  const group = await loadGroup(db, input.groupId);
  requireAdmin(group, input.uid);
  const ref = groupRef(db, input.groupId).collection("members").doc(input.memberId);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError("not_found", "member not found");
  const member = snap.data() as MemberDoc;
  if (member.uid && group.adminUids.includes(member.uid) && group.adminUids.length === 1) {
    throw invalid("the group needs at least one organizer");
  }

  const notices: Notice[] = [];
  const active = await groupRef(db, input.groupId).collection("games").where("status", "in", ACTIVE_STATUSES).get();
  for (const game of active.docs) {
    try {
      const r = await applyRosterAction(db, {
        groupId: input.groupId,
        gameId: game.id,
        memberId: input.memberId,
        action: "remove",
        source: "admin",
        actorUid: input.uid,
        now: input.now,
      });
      notices.push(...r.notices);
    } catch (e) {
      // Not on that poll's list, or it isn't open: nothing to undo.
      const code = asAppError(e)?.code;
      if (code !== "not_in" && code !== "poll_not_open" && code !== "game_closed") throw e;
    }
  }

  const batch = db.batch();
  batch.update(ref, { active: false });
  if (member.uid) {
    batch.update(groupRef(db, input.groupId), {
      memberUids: FieldValue.arrayRemove(member.uid),
      adminUids: FieldValue.arrayRemove(member.uid),
    });
    batch.set(db.collection("users").doc(member.uid), { groupIds: FieldValue.arrayRemove(input.groupId) }, { merge: true });
  }
  await batch.commit();
  return notices;
}

/** Link a signed-in phone number to every group that lists it. */
export async function claimMemberships(
  db: Firestore,
  input: { uid: string; phone: string },
): Promise<{ groupIds: string[] }> {
  const q = await db.collectionGroup("members").where("phone", "==", input.phone).get();
  const groupIds: string[] = [];
  const batch = db.batch();
  for (const doc of q.docs) {
    const member = doc.data() as MemberDoc;
    if (!member.active) continue;
    const gRef = doc.ref.parent.parent!;
    groupIds.push(gRef.id);
    if (member.uid !== input.uid) batch.update(doc.ref, { uid: input.uid });
    batch.update(gRef, {
      memberUids: FieldValue.arrayUnion(input.uid),
      ...(member.role === "admin" ? { adminUids: FieldValue.arrayUnion(input.uid) } : {}),
    });
  }
  batch.set(
    db.collection("users").doc(input.uid),
    groupIds.length ? { phone: input.phone, groupIds: FieldValue.arrayUnion(...groupIds) } : { phone: input.phone },
    { merge: true },
  );
  await batch.commit();
  return { groupIds };
}

export async function updateMyPreferences(
  db: Firestore,
  input: { groupId: string; uid: string; whatsappOptIn?: unknown; language?: unknown },
): Promise<void> {
  const { memberId } = await memberForUid(db, input.groupId, input.uid);
  const changes: Partial<MemberDoc> = {};
  if (input.whatsappOptIn !== undefined) {
    if (typeof input.whatsappOptIn !== "boolean") throw invalid("whatsappOptIn must be true or false");
    changes.whatsappOptIn = input.whatsappOptIn;
  }
  if (input.language !== undefined) {
    if (input.language !== "ar" && input.language !== "en") throw invalid("language must be ar or en");
    changes.language = input.language as Language;
  }
  await groupRef(db, input.groupId).collection("members").doc(memberId).update(changes);
}

export async function openPollNow(
  db: Firestore,
  input: { groupId: string; uid: string; gameId?: string | null; now: number },
): Promise<{ gameId: string }> {
  const group = await loadGroup(db, input.groupId);
  requireAdmin(group, input.uid);
  const gameId = input.gameId || (await ensureWeeklyGame(db, input.groupId, input.now)).gameId || group.currentGameId;
  if (!gameId) throw new AppError("not_found", "no poll to open");
  const ref = gameRef(db, input.groupId, gameId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("not_found", "poll not found");
    const game = snap.data() as GameDoc;
    if (game.status !== "scheduled") throw invalid("the poll is already open");
    tx.update(ref, {
      status: "open",
      pollOpensAt: Timestamp.fromMillis(input.now),
      updatedAt: Timestamp.fromMillis(input.now),
    });
  });
  return { gameId };
}

export async function recordResult(
  db: Firestore,
  input: { groupId: string; uid: string; gameId: string; winner: unknown; photoPath?: unknown; now: number },
): Promise<void> {
  const group = await loadGroup(db, input.groupId);
  requireAdmin(group, input.uid);
  const winner = nonEmpty(input.winner, "winner", 20);
  let photoPath: string | null = null;
  if (input.photoPath !== undefined && input.photoPath !== null) {
    const expected = `groups/${input.groupId}/champions/`;
    if (typeof input.photoPath !== "string" || !input.photoPath.startsWith(expected)) {
      throw invalid("photoPath must be in this group's champions folder");
    }
    photoPath = input.photoPath;
  }
  const ref = gameRef(db, input.groupId, input.gameId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("not_found", "game not found");
    const game = snap.data() as GameDoc;
    if (game.status === "cancelled") throw invalid("the game was cancelled");
    if (input.now < game.kickoffAt.toMillis()) throw invalid("the game has not started yet");
    // The winners are one of the teams that played: this game's kits, or the group's.
    const kits = game.teams?.teams.map((t) => t.kit) ?? group.rules.kits;
    if (!kits.some((k) => k.name === winner)) throw invalid("winner must be one of the teams");
    const stamp = Timestamp.fromMillis(input.now);
    tx.update(ref, {
      status: "played",
      result: { winner, photoPath, recordedAt: stamp, recordedBy: input.uid },
      updatedAt: stamp,
    });
    tx.update(groupRef(db, input.groupId), {
      lastChampions: { gameId: input.gameId, weekNumber: game.weekNumber, winner, photoPath },
      updatedAt: stamp,
    });
  });
}

function pick<T extends object>(obj: T, keys: string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in obj) out[k] = (obj as Record<string, unknown>)[k];
  }
  return out as Partial<T>;
}
