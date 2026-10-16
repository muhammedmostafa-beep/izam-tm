// Firestore document shapes and conversions to the pure domain types.
//
// groups/{groupId}                         GroupDoc
// groups/{groupId}/members/{memberId}      MemberDoc
// groups/{groupId}/games/{gameId}          GameDoc   (a poll; weekly ones are keyed by
//                                                     their local kick-off date, others get an auto ID)
// groups/{groupId}/games/{gameId}/entries/{memberId}   EntryDoc
// groups/{groupId}/games/{gameId}/log/{id} LogDoc    (every vote, for disputes)
// groups/{groupId}/private/levels          LevelsDoc (organizers only)
// users/{uid}                              UserDoc

import { Timestamp } from "firebase-admin/firestore";
import { DEFAULT_KITS, Kit } from "./domain/kits";
import { Entry, EntryState, OutReason, QuietHours, RosterRules, Source } from "./domain/roster";
import { WeeklySchedule } from "./domain/schedule";
import { Team } from "./domain/teams";

export interface GroupRules {
  /** Squad size for new polls. */
  squadSize: number;
  /** The kits teams play in, e.g. red, black and white. */
  kits: Kit[];
  confirmWindowMinutes: number;
  matchDayConfirmWindowMinutes: number;
  lateDropOutHours: number;
  quietHours: QuietHours | null;
}

export interface GroupReminders {
  pollOpening: boolean;
  promotion: boolean;
  matchDay: boolean;
  matchDayHoursBefore: number;
}

export interface Champions {
  gameId: string;
  weekNumber: number;
  winner: string;
  photoPath: string | null;
}

export interface GroupDoc {
  name: string;
  venue: string;
  countryCode: string; // for local phone numbers, "20" for Egypt
  schedule: WeeklySchedule;
  rules: GroupRules;
  reminders: GroupReminders;
  pitchFee: number | null;
  adminUids: string[];
  memberUids: string[];
  currentGameId: string | null;
  weekCounter: number;
  lastChampions: Champions | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type Role = "admin" | "player";
export type Language = "ar" | "en";

export interface MemberDoc {
  name: string;
  phone: string; // E.164, e.g. "+201001234567"
  uid: string | null;
  role: Role;
  isGoalkeeper: boolean;
  whatsappOptIn: boolean;
  language: Language;
  active: boolean;
  createdAt: Timestamp;
}

export type GameStatus = "scheduled" | "open" | "closed" | "played" | "cancelled";

/** "weekly" polls come from the group's schedule; "custom" ones an organizer made. */
export type GameKind = "weekly" | "custom";

export interface TeamsDoc {
  teams: Team[];
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface GameResult {
  winner: string;
  photoPath: string | null;
  recordedAt: Timestamp;
  recordedBy: string;
}

export interface GameDoc {
  kind: GameKind;
  /** Running number of the group's games, shown as "Week 12". */
  weekNumber: number;
  kickoffAt: Timestamp;
  durationMinutes: number;
  venue: string;
  pollOpensAt: Timestamp;
  status: GameStatus;
  nextSeq: number;
  squadSize: number;
  squadCount: number;
  reserveCount: number;
  nextOfferExpiry: Timestamp | null;
  pollOpenNotified: boolean;
  matchDayReminderSent: boolean;
  result: GameResult | null;
  teams: TeamsDoc | null;
  /** Who made a custom poll; null for weekly ones. */
  createdBy: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * How good each player is, for balancing teams. Organizers only; players never
 * see it. 1 top, 2 about 70%, 3 about 50% or below, 4 weak, 0 new / not sure.
 */
export type Level = 0 | 1 | 2 | 3 | 4;

export interface LevelsDoc {
  levels: Record<string, Level>;
  updatedAt: Timestamp;
}

export interface EntryDoc {
  memberId: string;
  name: string;
  seq: number;
  joinedAt: Timestamp;
  state: EntryState;
  source: Source;
  offerExpiresAt: Timestamp | null;
  outReason: OutReason | null;
  outAt: Timestamp | null;
  lateDropOut: boolean | null;
}

export interface UserDoc {
  phone: string;
  groupIds: string[];
  pushIds: string[];
  language: Language;
}

export const DEFAULT_SCHEDULE: WeeklySchedule = {
  timeZone: "Africa/Cairo",
  matchWeekday: 4,
  matchTime: "21:00",
  matchDurationMinutes: 90,
  pollOpenWeekday: 7,
  pollOpenTime: "12:00",
  enabled: true,
};

export const DEFAULT_RULES: GroupRules = {
  squadSize: 18,
  kits: DEFAULT_KITS,
  confirmWindowMinutes: 120,
  matchDayConfirmWindowMinutes: 30,
  lateDropOutHours: 24,
  quietHours: { start: "00:00", end: "08:00" },
};

export const DEFAULT_REMINDERS: GroupReminders = {
  pollOpening: true,
  promotion: true,
  matchDay: true,
  matchDayHoursBefore: 4,
};

/** The list rules for one poll: the group's, with the poll's own squad size. */
export function rosterRules(group: GroupDoc, game?: Pick<GameDoc, "squadSize">): RosterRules {
  return {
    squadSize: game?.squadSize ?? group.rules.squadSize,
    confirmWindowMinutes: group.rules.confirmWindowMinutes,
    matchDayConfirmWindowMinutes: group.rules.matchDayConfirmWindowMinutes,
    lateDropOutHours: group.rules.lateDropOutHours,
    quietHours: group.rules.quietHours,
    timeZone: group.schedule.timeZone,
  };
}

const ms = (t: Timestamp | null | undefined) => (t ? t.toMillis() : undefined);
const ts = (n: number | undefined) => (n === undefined ? null : Timestamp.fromMillis(n));

export function entryFromDoc(d: EntryDoc): Entry {
  const e: Entry = {
    memberId: d.memberId,
    name: d.name,
    seq: d.seq,
    joinedAt: d.joinedAt.toMillis(),
    state: d.state,
    source: d.source,
  };
  if (d.offerExpiresAt) e.offerExpiresAt = ms(d.offerExpiresAt);
  if (d.outReason) e.outReason = d.outReason;
  if (d.outAt) e.outAt = ms(d.outAt);
  if (d.lateDropOut !== null && d.lateDropOut !== undefined) e.lateDropOut = d.lateDropOut;
  return e;
}

export function entryToDoc(e: Entry): EntryDoc {
  return {
    memberId: e.memberId,
    name: e.name,
    seq: e.seq,
    joinedAt: Timestamp.fromMillis(e.joinedAt),
    state: e.state,
    source: e.source,
    offerExpiresAt: ts(e.offerExpiresAt),
    outReason: e.outReason ?? null,
    outAt: ts(e.outAt),
    lateDropOut: e.lateDropOut ?? null,
  };
}
