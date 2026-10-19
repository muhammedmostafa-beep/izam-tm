// Man of the match: everyone who played votes for someone else who played.
// Votes are secret; only the result is shown, after voting closes.

export interface MvpResult {
  /** Most votes; several players when they tie. Empty when nobody voted. */
  winners: string[];
  winnerVotes: number;
}

export function tally(choices: string[]): MvpResult {
  const counts = new Map<string, number>();
  for (const c of choices) counts.set(c, (counts.get(c) ?? 0) + 1);
  const top = Math.max(0, ...counts.values());
  const winners = [...counts.entries()].filter(([, n]) => n === top && top > 0).map(([id]) => id).sort();
  return { winners, winnerVotes: top };
}
