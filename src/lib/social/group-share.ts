/**
 * Group share queue: share one post to many Facebook and LinkedIn groups by hand.
 *
 * Neither network has a group posting API, so nothing is posted from here. For each
 * group the hub copies the text, opens the group, and a person taps Post. These
 * helpers are pure (no IO) so they are unit-tested.
 */

export type GroupNetwork = "facebook" | "linkedin";
export type ShareStatus = "waiting" | "opened" | "posted" | "skipped";

export type ShareItem = {
  id: string;
  group_id: string;
  group_name: string;
  group_url: string;
  members: number | null;
  rule_note: string | null;
  skip_days: number[];
  assignee_id: string | null;
  assignee_name: string | null;
  position: number;
  text: string;
  post_id: string | null;
  status: ShareStatus;
  opened_at: string | null;
  posted_at: string | null;
  removed_at: string | null;
};

export type SocialGroup = {
  id: string;
  network: GroupNetwork;
  name: string;
  url: string;
  members: number | null;
  owner_id: string | null;
  owner_name: string | null;
  rule_note: string | null;
  skip_days: number[];
  needs_approval: boolean;
  active: boolean;
  campaign_id: string | null;
};

export const WAIT_OPTIONS = [5, 10, 15] as const;
export const CAP_OPTIONS = [5, 10, 20] as const;

/** Defaults per network: LinkedIn is stricter than Facebook. */
export const NETWORK_DEFAULTS: Record<GroupNetwork, { wait: number; cap: number; label: string; tagPrefix: string }> = {
  facebook: { wait: 5, cap: 10, label: "Facebook groups", tagPrefix: "fbg" },
  linkedin: { wait: 10, cap: 5, label: "LinkedIn groups", tagPrefix: "lig" },
};

/** Opening lines rotated across groups so no two groups get the identical post. */
export const OPENERS = [
  "",
  "Quick one for this group: ",
  "Sharing in case it helps: ",
  "For the founders here: ",
  "Thought this might be useful: ",
];

/** True for a Facebook group link (facebook.com/groups/<name or id>). */
export function isFacebookGroupUrl(input: string): boolean {
  try {
    const u = new URL(input.trim());
    return /(^|\.)facebook\.com$/i.test(u.hostname) && /^\/groups\/[^/]+/i.test(u.pathname);
  } catch {
    return false;
  }
}

/** True for a LinkedIn group link (linkedin.com/groups/<id>). */
export function isLinkedInGroupUrl(input: string): boolean {
  try {
    const u = new URL(input.trim());
    return /(^|\.)linkedin\.com$/i.test(u.hostname) && /^\/groups\/[^/]+/i.test(u.pathname);
  } catch {
    return false;
  }
}

/** Check a group link against the network it was saved for. */
export function isGroupUrl(network: GroupNetwork, input: string): boolean {
  return network === "linkedin" ? isLinkedInGroupUrl(input) : isFacebookGroupUrl(input);
}

/** Strip tracking noise so the same group is never saved twice. */
export function normalizeGroupUrl(input: string, network: GroupNetwork = "facebook"): string {
  const u = new URL(input.trim());
  const m = u.pathname.match(/^\/groups\/([^/]+)/i);
  const id = m ? m[1] : "";
  return network === "linkedin" ? `https://www.linkedin.com/groups/${id}` : `https://www.facebook.com/groups/${id}`;
}

/** The exact text copied for one group: optional opener, the post, then the link once. */
export function buildShareText(body: string, link: string | null, index: number, vary: boolean): string {
  const opener = vary ? OPENERS[index % OPENERS.length] : "";
  const main = body.trim();
  const url = (link ?? "").trim();
  const withLink = url && !main.includes(url) ? `${main}\n\n${url}` : main;
  return `${opener}${withLink}`;
}

/** Day numbers (0 Sunday to 6 Saturday) for a rule such as "no promotion on Mondays". */
export function isSkipDay(skipDays: number[], date: Date): boolean {
  return skipDays.includes(date.getDay());
}

export type PacingState = { allowed: boolean; reason: "ok" | "cap" | "wait" | "rule"; waitSeconds: number };

/**
 * Whether the next group may be opened now. A group rule skips the group; the daily
 * cap counts groups opened today; the wait counts from the last group opened.
 */
export function pacing(
  items: Pick<ShareItem, "status" | "opened_at" | "skip_days">[],
  nextSkipDays: number[],
  waitMinutes: number,
  dailyCap: number,
  now: Date,
): PacingState {
  if (isSkipDay(nextSkipDays, now)) return { allowed: false, reason: "rule", waitSeconds: 0 };
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const opened = items.filter((i) => i.opened_at && new Date(i.opened_at) >= startOfDay);
  if (opened.length >= dailyCap) return { allowed: false, reason: "cap", waitSeconds: 0 };
  const last = items.reduce<number>((max, i) => (i.opened_at ? Math.max(max, new Date(i.opened_at).getTime()) : max), 0);
  const waitMs = last ? last + waitMinutes * 60_000 - now.getTime() : 0;
  if (waitMs > 0) return { allowed: false, reason: "wait", waitSeconds: Math.ceil(waitMs / 1000) };
  return { allowed: true, reason: "ok", waitSeconds: 0 };
}

export function summarize(items: Pick<ShareItem, "status">[]): { posted: number; opened: number; waiting: number; skipped: number; total: number } {
  const c = { posted: 0, opened: 0, waiting: 0, skipped: 0, total: items.length };
  for (const i of items) c[i.status] += 1;
  return c;
}

/** Rough time left: groups still to do times the wait between them. */
export function estimateMinutes(remaining: number, waitMinutes: number): number {
  return remaining <= 1 ? 0 : (remaining - 1) * waitMinutes;
}

export type ReviewTag = "keep" | "watch" | "drop" | null;

/**
 * Keep, Watch or Drop? for one group. Needs 30 days since the first post or 3 posts,
 * so a young group is never judged. Keep = meetings or 2+ signups, Drop? = no clicks.
 */
export function reviewTag(g: { posts: number; firstPostAt: string | null; clicks: number; signups: number; meetings: number }, now: Date): ReviewTag {
  const ageDays = g.firstPostAt ? (now.getTime() - new Date(g.firstPostAt).getTime()) / 86_400_000 : 0;
  if (g.posts < 3 && ageDays < 30) return null;
  if (g.meetings > 0 || g.signups >= 2) return "keep";
  if (g.clicks === 0) return "drop";
  return "watch";
}
