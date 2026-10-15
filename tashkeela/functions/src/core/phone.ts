/**
 * Normalize a phone number to E.164 ("+201001234567"). Local numbers that
 * start with a single 0 get the group's country code, so organizers can paste
 * numbers the way people write them in Egypt ("010 0123 4567").
 */
export function normalizePhone(input: string, countryCode: string): string | null {
  let s = input.replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  else if (s.startsWith("0")) s = "+" + countryCode + s.slice(1);
  else if (!s.startsWith("+")) s = "+" + s;
  return /^\+[1-9]\d{7,14}$/.test(s) ? s : null;
}

/** WhatsApp identifies people by the E.164 number without the "+". */
export function toWaId(e164: string): string {
  return e164.replace(/^\+/, "");
}

export function fromWaId(waId: string): string {
  return "+" + waId.replace(/^\+/, "");
}
