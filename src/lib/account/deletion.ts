/** Self service account deletion: 30 day grace period, then permanent removal. */
export const DELETION_GRACE_DAYS = 30;
export const DELETE_CONFIRM_PHRASE = "delete my account";

export function isConfirmPhrase(input: unknown): boolean {
  return typeof input === "string" && input.trim().toLowerCase() === DELETE_CONFIRM_PHRASE;
}

export function scheduledPurgeDate(from: Date = new Date()): Date {
  return new Date(from.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
}

export function isPurgeDue(scheduledFor: string | null | undefined, now: Date = new Date()): boolean {
  if (!scheduledFor) return false;
  const at = Date.parse(scheduledFor);
  return Number.isFinite(at) && at <= now.getTime();
}
