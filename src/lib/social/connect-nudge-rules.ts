/**
 * Rules for the "Connect with investors" nudge. Pure, no server imports, so the
 * banner component and the tests can use it too.
 */
export const NUDGE_FEATURE = "social_nudge";
export const NUDGE_NOTIFICATION_TYPE = "social_connect_nudge";
export const SNOOZE_DAYS = 7;
export const MAX_DISMISSALS = 2;
export const CONNECT_PATH = "/founder/deploy/social?tab=settings";

/** The next unfinished Launch my social media step the home banner points at. */
export type LaunchNudgeStep = "connect" | "campaign" | "post";
export const LAUNCH_NUDGE_COPY: Record<LaunchNudgeStep, { title: string; body: string; cta: string; path: string; percent: number; position: number }> = {
  connect: { title: "Connect an account", body: "Link LinkedIn, Facebook, Instagram or Reddit so you can post from here.", cta: "Connect an account", path: "/founder/deploy/social?tab=settings", percent: 0, position: 1 },
  campaign: { title: "Create a campaign", body: "A campaign groups your posts and rolls their results up to one goal.", cta: "Create a campaign", path: "/founder/deploy/social?tab=campaigns", percent: 25, position: 2 },
  post: { title: "Write your first post", body: "Your draft is ready. Pick a topic, choose where it goes and schedule it.", cta: "Write a post", path: "/founder/deploy/social?tab=compose", percent: 50, position: 3 },
};

/** Next step from real data. Null once a post is scheduled or published, so the banner stops. */
export function launchNudgeStep(d: { connected: boolean; campaigns: number; livePosts: number }): LaunchNudgeStep | null {
  if (!d.connected) return "connect";
  if (d.campaigns === 0) return "campaign";
  if (d.livePosts === 0) return "post";
  return null;
}

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

/** Whether the Launch my social media banner is due. Same plan, switch and close rules as the connect nudge. */
export function shouldShowLaunchNudge(f: ConnectNudgeFacts, step: LaunchNudgeStep | null, now: Date = new Date()): boolean {
  if (step === null) return false;
  return shouldShowConnectNudge({ ...f, connected: false }, now);
}
