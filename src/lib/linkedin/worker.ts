// Pure helpers for the LinkedIn sender: sender keys, the owner's local day, and how long the
// sender should wait for each reason. No database here, so every rule is unit tested.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { SendDecision } from "./safety";
import type { NetworkFilters } from "./network";

/** At least this long between two actions on the account, whatever the sender asks. */
export const MIN_GAP_MINUTES = 4;
/** A target handed to the sender stays reserved this long, so it is never sent twice. */
export const LEASE_MINUTES = 30;
/** A dry run puts the target on hold this long so the next ask returns a different person. */
export const DRY_RUN_HOLD_HOURS = 12;

export function generateSenderKey(): string {
  return `lis_${randomBytes(24).toString("hex")}`;
}

export function hashSenderKey(key: string): string {
  return createHash("sha256").update(key.trim()).digest("hex");
}

/** Constant time check of a presented key against a stored hash. */
export function senderKeyMatches(storedHash: string | null | undefined, presented: string | null | undefined): boolean {
  if (!storedHash || !presented) return false;
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(hashSenderKey(presented), "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** The key in an `Authorization: Bearer <key>` header, or null. */
export function bearerKey(header: string | null | undefined): string | null {
  const m = /^Bearer\s+(lis_[a-f0-9]{48})$/.exec((header ?? "").trim());
  return m ? m[1] : null;
}

/** How far the zone is ahead of UTC at an instant, in milliseconds. */
export function tzOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Midnight at the start of the owner's local day, as an instant. An unknown zone falls back to UTC. */
export function startOfLocalDay(now: Date, timeZone: string): Date {
  try {
    const off0 = tzOffsetMs(now, timeZone);
    const local = new Date(now.getTime() + off0);
    const guess = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    let result = guess - tzOffsetMs(new Date(guess), timeZone);
    result = guess - tzOffsetMs(new Date(result), timeZone); // settle across a daylight saving change
    return new Date(result);
  } catch {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
}

export type WaitReason = "paused" | "not_started" | "outside_hours" | "daily_cap" | "weekly_cap" | "gap" | "nothing_queued" | "switched_off";

export type WorkerNext =
  | { action: "invite"; targetId: string; slug: string; text: string; variantId: string; contactName: string | null }
  | { action: "message"; targetId: string; slug: string; text: string; contactName: string | null }
  | { action: "read"; campaignId: string; page: number; searchUrl: string | null; filters: NetworkFilters }
  | { action: "wait"; reason: WaitReason; retryMinutes: number }
  | { action: "stop"; reason: string };

/** Minutes the sender should wait before asking again. */
export function retryMinutesFor(reason: WaitReason): number {
  switch (reason) {
    case "gap": return MIN_GAP_MINUTES;
    case "outside_hours": return 30;
    case "daily_cap": return 60;
    case "weekly_cap": return 180;
    case "nothing_queued": return 30;
    case "switched_off": return 30;
    default: return 15;
  }
}

export function waitFromDecision(d: Exclude<SendDecision, { ok: true }>): WorkerNext {
  return { action: "wait", reason: d.reason, retryMinutes: retryMinutesFor(d.reason) };
}
