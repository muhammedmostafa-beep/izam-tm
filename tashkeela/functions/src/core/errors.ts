import { RosterError, RosterErrorCode } from "../domain/roster";

export type AppErrorCode =
  | RosterErrorCode
  | "unauthenticated"
  | "permission_denied"
  | "not_found"
  | "not_member"
  | "invalid"
  | "already_exists"
  | "poll_not_open"
  | "game_closed";

/** An expected failure the app shows to the player (not a bug). */
export class AppError extends Error {
  constructor(public readonly code: AppErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AppError";
  }
}

export function asAppError(e: unknown): AppError | null {
  if (e instanceof AppError) return e;
  if (e instanceof RosterError) return new AppError(e.code, e.message);
  return null;
}

export function invalid(message: string): AppError {
  return new AppError("invalid", message);
}
