/**
 * Rules for the "Connect with investors" nudge. Pure, no server imports, so the
 * banner component and the tests can use it too.
 */
export const NUDGE_FEATURE = "social_nudge";
export const NUDGE_NOTIFICATION_TYPE = "social_connect_nudge";
export const SNOOZE_DAYS = 7;
export const MAX_DISMISSALS = 2;
export const CONNECT_PATH = "/founder/deploy/social?tab=settings";

/** Paid founder plans. Free and trial founders are not nudged. */
export const NUDGE_PLANS = ["founder_basic", "founder_professional", "founder_premium", "founder_managed_ir"] as const;

export type ConnectNudgeFacts = {
  flagOn: boolean;
  planType: string | null;
  status: string | null;
  socialEnabled: boolean;
  connected: boolean;
  dismissals: number;
  snoozedUntil: string | null;
};

/** Whether the nudge is due for these facts. */
export function shouldShowConnectNudge(f: ConnectNudgeFacts, now: Date = new Date()): boolean {
  if (!f.flagOn) return false;
  if (f.status !== "active") return false;
  if (!f.planType || !(NUDGE_PLANS as readonly string[]).includes(f.planType)) return false;
  if (!f.socialEnabled) return false;
  if (f.connected) return false;
  if (f.dismissals >= MAX_DISMISSALS) return false;
  if (f.snoozedUntil) {
    const until = new Date(f.snoozedUntil).getTime();
    if (Number.isFinite(until) && until > now.getTime()) return false;
  }
  return true;
}

/** The snooze end for a "remind me later" or close made at `now`. */
export function snoozeUntil(now: Date = new Date()): string {
  return new Date(now.getTime() + SNOOZE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** Preference values after one close or snooze. A close counts toward the limit; a snooze does not. */
export function nextNudgeState(action: "snooze" | "dismiss", dismissals: number, now: Date = new Date()): { dismissals: number; snoozedUntil: string } {
  return { dismissals: action === "dismiss" ? dismissals + 1 : dismissals, snoozedUntil: snoozeUntil(now) };
}
