// A game's teams as the organizer saved them. The app suggests balanced teams
// from the players' levels (app/lib/teams.dart); the server only checks that
// the split makes sense, since the organizer may move players around.

import { Kit, KitError, normalizeKits } from "./kits";

export interface Team {
  kit: Kit;
  memberIds: string[];
}

export class TeamsError extends Error {}

export function validateTeams(input: unknown, memberIds: ReadonlySet<string>): Team[] {
  if (!Array.isArray(input)) throw new TeamsError("teams must be a list");
  let kits: Kit[];
  try {
    kits = normalizeKits(input.map((t) => (t && typeof t === "object" ? (t as Record<string, unknown>).kit : null)));
  } catch (e) {
    throw new TeamsError((e as KitError).message);
  }
  const seen = new Set<string>();
  return input.map((t, i) => {
    const ids = (t as Record<string, unknown>).memberIds;
    if (!Array.isArray(ids)) throw new TeamsError("each team needs its list of players");
    for (const id of ids) {
      if (typeof id !== "string" || !memberIds.has(id)) throw new TeamsError("a team lists someone who isn't in the group");
      if (seen.has(id)) throw new TeamsError("a player is on two teams");
      seen.add(id);
    }
    return { kit: kits[i], memberIds: ids as string[] };
  });
}
