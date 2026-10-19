// Splitting the pitch fee among the players of a game, and who has paid.

export type PaymentState = "unpaid" | "claimed" | "paid";

export interface Payments {
  /** The whole pitch fee for this game, in EGP. */
  fee: number;
  /** Each player's share, rounded up to a whole pound. */
  perPlayer: number;
  /** Member id to payment state: "claimed" means the player says they paid and the organizer hasn't confirmed yet. */
  players: Record<string, PaymentState>;
}

export function share(fee: number, players: number): number {
  return players > 0 ? Math.ceil(fee / players) : 0;
}

/**
 * The fee split over the game's players. Anyone already on the list keeps
 * their payment state; new players start unpaid.
 */
export function splitFee(fee: number, memberIds: string[], before?: Payments | null): Payments {
  const players: Record<string, PaymentState> = {};
  for (const id of memberIds) players[id] = before?.players[id] ?? "unpaid";
  return { fee, perPlayer: share(fee, memberIds.length), players };
}

export function unpaid(p: Payments): string[] {
  return Object.entries(p.players)
    .filter(([, s]) => s === "unpaid")
    .map(([id]) => id);
}
