// Client-safe half of outreach-status: the shape and the status line copy.
// The loader lives in outreach-status.ts (server only).

/** Remembers the last Outreach mode; the deploy page reads it for the first render. */
export const OUTREACH_MODE_COOKIE = "icapos_outreach_mode";

export type AutomatedOutreachState = "running" | "paused" | "not_started";

export type OutreachStatus = {
  automated: { state: AutomatedOutreachState; sent: number; launched: boolean };
  /** opened and replied are manual emails with an open or reply recorded (optional, display only). */
  manual: { sent: number; started: boolean; opened?: number; replied?: number };
  /** Third channel, under Outreach: the founder's connected social accounts and published posts.
   *  Display only. It never changes `complete`, which stays automated AND manual. */
  social?: SocialOutreach;
  /** Both modes used — the Outreach step is done. */
  complete: boolean;
};

export type SocialOutreachState = "not_started" | "connected" | "posting";
export type SocialOutreach = { state: SocialOutreachState; accounts: number; published: number };

export const EMPTY_SOCIAL_OUTREACH: SocialOutreach = { state: "not_started", accounts: 0, published: 0 };

export const EMPTY_OUTREACH_STATUS: OutreachStatus = {
  automated: { state: "not_started", sent: 0, launched: false },
  manual: { sent: 0, started: false },
  complete: false,
};

/** The one-line status under each mode in the Outreach dropdown. */
export function automatedStatusLine(s: OutreachStatus, opts?: { requiredNote?: boolean }): string {
  if (s.automated.state === "running") return `Running, ${s.automated.sent} sent`;
  if (s.automated.state === "paused") return `Paused, ${s.automated.sent} sent`;
  return opts?.requiredNote ? "Not started, needed to complete Stage 3" : "Not started";
}

export function manualStatusLine(s: OutreachStatus, opts?: { requiredNote?: boolean }): string {
  if (s.manual.started) return `${s.manual.sent} sent`;
  return opts?.requiredNote ? "Not started, needed to complete Stage 3" : "Not started";
}

/** Short result line for manual outreach: "8 sent, 3 opened, 1 replied". */
export function manualResultsLine(s: OutreachStatus): string {
  const parts = [`${s.manual.sent} sent`];
  if (s.manual.opened) parts.push(`${s.manual.opened} opened`);
  if (s.manual.replied) parts.push(`${s.manual.replied} replied`);
  return parts.join(", ");
}

/** One-line Social media status: "Not started", "2 accounts connected, no posts yet", "5 posts published". */
export function socialStatusLine(s: OutreachStatus): string {
  const soc = s.social ?? EMPTY_SOCIAL_OUTREACH;
  if (soc.state === "posting") return `${soc.published} ${soc.published === 1 ? "post" : "posts"} published`;
  if (soc.state === "connected") return `${soc.accounts} ${soc.accounts === 1 ? "account" : "accounts"} connected, no posts yet`;
  return "Not started";
}

/** How many of the three channels are under way (automated launched, manual sent, social posting). */
export function outreachChannelsDone(s: OutreachStatus): number {
  return (s.automated.launched ? 1 : 0) + (s.manual.started ? 1 : 0) + ((s.social?.state ?? "not_started") === "posting" ? 1 : 0);
}
