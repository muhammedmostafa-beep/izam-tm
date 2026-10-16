// Team kits: the bib colors teams play in. Red, black and white are the usual
// three; any other color has to say what it is (a name and the color itself).

export type KitColor = "red" | "black" | "white" | "other";

export interface Kit {
  color: KitColor;
  /** "Red", "Black", "White", or the organizer's name for another color, e.g. "Blue". */
  name: string;
  /** "#RRGGBB" */
  hex: string;
}

export const BASE_KITS: Record<Exclude<KitColor, "other">, Kit> = {
  red: { color: "red", name: "Red", hex: "#D32F2F" },
  black: { color: "black", name: "Black", hex: "#1C1C1C" },
  white: { color: "white", name: "White", hex: "#F5F5F5" },
};

export const DEFAULT_KITS: Kit[] = [BASE_KITS.red, BASE_KITS.black, BASE_KITS.white];

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 6;

export class KitError extends Error {}

/** A kit as the organizer sent it, checked. Red, black and white always use their standard name and color. */
export function normalizeKit(input: unknown): Kit {
  if (!input || typeof input !== "object") throw new KitError("each kit needs a color");
  const { color, name, hex } = input as Record<string, unknown>;
  if (color === "red" || color === "black" || color === "white") return BASE_KITS[color];
  if (color !== "other") throw new KitError("kit color must be red, black, white or other");
  if (typeof name !== "string" || !name.trim() || name.trim().length > 20) {
    throw new KitError("a kit in another color needs a name of up to 20 characters");
  }
  if (typeof hex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new KitError("a kit in another color needs its color as #RRGGBB");
  }
  return { color: "other", name: name.trim(), hex: hex.toUpperCase() };
}

/** The kits a group plays in: 2 to 6, no two with the same name. */
export function normalizeKits(input: unknown): Kit[] {
  if (!Array.isArray(input) || input.length < MIN_TEAMS || input.length > MAX_TEAMS) {
    throw new KitError(`choose ${MIN_TEAMS} to ${MAX_TEAMS} kits`);
  }
  const kits = input.map(normalizeKit);
  const names = new Set(kits.map((k) => k.name.toLowerCase()));
  if (names.size !== kits.length) throw new KitError("two kits have the same name");
  return kits;
}
