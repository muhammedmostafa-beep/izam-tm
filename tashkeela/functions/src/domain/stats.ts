// The season table: who played, won, was voted man of the match, and dropped out late.

export interface GameRecord {
  /** Everyone in the squad at kick-off. */
  squad: string[];
  /** The winning team's players, when the result and teams were recorded. */
  winners: string[];
  /** Man of the match (several when tied). */
  mvp: string[];
  dropOuts: string[];
  lateDropOuts: string[];
}

export interface PlayerStats {
  name: string;
  played: number;
  wins: number;
  mvp: number;
  dropOuts: number;
  lateDropOuts: number;
}

export function seasonTable(games: GameRecord[], names: Record<string, string>): Record<string, PlayerStats> {
  const table: Record<string, PlayerStats> = {};
  const row = (id: string) =>
    (table[id] ??= { name: names[id] ?? "?", played: 0, wins: 0, mvp: 0, dropOuts: 0, lateDropOuts: 0 });
  for (const g of games) {
    const squad = new Set(g.squad);
    for (const id of squad) row(id).played++;
    for (const id of g.winners) if (squad.has(id)) row(id).wins++;
    for (const id of g.mvp) row(id).mvp++;
    for (const id of g.dropOuts) row(id).dropOuts++;
    for (const id of g.lateDropOuts) row(id).lateDropOuts++;
  }
  return table;
}
