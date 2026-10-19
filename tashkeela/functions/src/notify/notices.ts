import { RosterEvent } from "../domain/roster";

/**
 * Something people should hear about. Core operations return notices and the
 * dispatcher turns them into push notifications and WhatsApp messages after
 * the database change has been committed.
 */
export type Notice =
  /** "regulars": the regulars' head start; "others": everyone else, after a head start; "all" (default): everyone. */
  | { kind: "poll_open"; groupId: string; gameId: string; audience?: "regulars" | "others" | "all" }
  | { kind: "offered"; groupId: string; gameId: string; memberId: string; expiresAt: number }
  | { kind: "expired"; groupId: string; gameId: string; memberId: string }
  | { kind: "match_day"; groupId: string; gameId: string }
  /** The organizer moved the game or changed its place; tells everyone on the list. */
  | { kind: "poll_changed"; groupId: string; gameId: string }
  /** The organizer called the game off; tells everyone on the list. */
  | { kind: "poll_cancelled"; groupId: string; gameId: string }
  /** The organizer reminds players who haven't paid their share of the pitch. */
  | { kind: "payment_due"; groupId: string; gameId: string; memberIds: string[] }
  | {
      kind: "dropped";
      groupId: string;
      gameId: string;
      memberId: string;
      late: boolean;
      replacementId: string | null;
    };

export function noticesFromEvents(groupId: string, gameId: string, events: RosterEvent[]): Notice[] {
  const offered = events.find((e) => e.type === "offered");
  const notices: Notice[] = [];
  for (const e of events) {
    if (e.type === "offered") {
      notices.push({ kind: "offered", groupId, gameId, memberId: e.memberId, expiresAt: e.expiresAt });
    } else if (e.type === "expired") {
      notices.push({ kind: "expired", groupId, gameId, memberId: e.memberId });
    } else if (e.type === "dropped" && e.wasInSquad) {
      notices.push({
        kind: "dropped",
        groupId,
        gameId,
        memberId: e.memberId,
        late: e.late,
        replacementId: offered ? offered.memberId : null,
      });
    }
  }
  return notices;
}
