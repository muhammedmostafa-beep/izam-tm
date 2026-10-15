import { RosterEvent } from "../domain/roster";

/**
 * Something people should hear about. Core operations return notices and the
 * dispatcher turns them into push notifications and WhatsApp messages after
 * the database change has been committed.
 */
export type Notice =
  | { kind: "poll_open"; groupId: string; gameId: string }
  | { kind: "offered"; groupId: string; gameId: string; memberId: string; expiresAt: number }
  | { kind: "expired"; groupId: string; gameId: string; memberId: string }
  | { kind: "match_day"; groupId: string; gameId: string }
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
