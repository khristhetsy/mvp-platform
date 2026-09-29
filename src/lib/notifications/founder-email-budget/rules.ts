/**
 * Pure decisions for the founder email budget, kept free of I/O so they are
 * tested directly. The gate and the digest job load data and call these.
 */
import type { BudgetConfig, FounderEmailMode } from "./config";

export type Cohort = "rollout" | "holdout" | "control";

/** Stable 0 to 99 bucket for a user id (same hash as the nav v2 rollout). */
export function budgetBucket(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 100;
}

/**
 * Holdout founders take the top buckets and never get the new rules; rollout
 * founders take the bottom buckets. The two ranges never overlap because the
 * rollout is capped at 100 minus the holdout.
 */
export function cohortFor(userId: string, cfg: Pick<BudgetConfig, "rolloutPct" | "holdoutPct">): Cohort {
  const b = budgetBucket(userId);
  if (b >= 100 - cfg.holdoutPct) return "holdout";
  if (b < cfg.rolloutPct) return "rollout";
  return "control";
}

export type LocalParts = { hour: number; minute: number; weekday: number; dateKey: string };

/** Hour, minute, weekday (0 = Sunday) and YYYY-MM-DD for `now` in the zone. Bad zones fall back to UTC. */
export function localParts(now: Date, timeZone: string | null | undefined): LocalParts {
  const utc = (): LocalParts => ({
    hour: now.getUTCHours(),
    minute: now.getUTCMinutes(),
    weekday: now.getUTCDay(),
    dateKey: now.toISOString().slice(0, 10),
  });
  if (!timeZone) return utc();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return {
      hour: Number(get("hour")) % 24,
      minute: Number(get("minute")),
      weekday: Math.max(0, days.indexOf(get("weekday"))),
      dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    };
  } catch {
    return utc();
  }
}

function toMinutes(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}

/** True when the local time falls inside the quiet window (which may cross midnight). */
export function inQuietHours(local: Pick<LocalParts, "hour" | "minute">, start: string, end: string): boolean {
  const cur = local.hour * 60 + local.minute;
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === e) return false;
  return s < e ? cur >= s && cur < e : cur >= s || cur < e;
}

export type DigestTiming = {
  mode: FounderEmailMode;
  /** The founder's hour, or the admin default. */
  sendHour: number;
  local: LocalParts;
  /** Local date keys of digests already sent to this founder today (usually 0 or 1). */
  sentToday: number;
  cfg: Pick<BudgetConfig, "dailyCap" | "quietStart" | "quietEnd" | "rules">;
};

/**
 * Whether the digest should go out in this hourly run. Daily: at the send hour.
 * Weekly: Mondays at the send hour. Instant: never. Never past the daily cap or
 * inside quiet hours.
 */
export function digestDue(t: DigestTiming): boolean {
  if (t.mode === "instant") return false;
  if (t.sentToday >= t.cfg.dailyCap) return false;
  if (t.local.hour !== t.sendHour) return false;
  if (t.mode === "weekly" && t.local.weekday !== 1) return false;
  if (t.cfg.rules.quietHours && inQuietHours(t.local, t.cfg.quietStart, t.cfg.quietEnd)) return false;
  return true;
}

/**
 * Move a founder down a tier after `after` digests in a row went unopened.
 * `recent` is newest first; only digests older than a day count, so a digest
 * sent this morning is not held against anyone yet.
 */
export function downshiftTarget(
  mode: FounderEmailMode,
  recent: Array<{ openedAt: string | null; clickedAt: string | null; sentAt: string }>,
  after: number,
  now: Date,
): FounderEmailMode | null {
  if (after <= 0 || mode === "instant") return null;
  const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;
  const settled = recent.filter((r) => new Date(r.sentAt).getTime() < dayAgo);
  if (settled.length < after) return null;
  const lastN = settled.slice(0, after);
  if (lastN.some((r) => r.openedAt || r.clickedAt)) return null;
  return mode === "daily" ? "weekly" : "instant";
}

export type ComplaintState = { rate: number; sent: number; complaints: number; level: "ok" | "alert" | "pause" };

/** Complaint rate as a percent, with the pause only when the sample is big enough. */
export function complaintState(
  sent: number,
  complaints: number,
  cfg: Pick<BudgetConfig, "complaintAlertPct" | "complaintPausePct" | "complaintMinSample" | "rules">,
): ComplaintState {
  const rate = sent > 0 ? (complaints / sent) * 100 : 0;
  let level: ComplaintState["level"] = "ok";
  if (cfg.rules.complaintGuard && sent > 0) {
    if (rate >= cfg.complaintPausePct && sent >= cfg.complaintMinSample) level = "pause";
    else if (rate >= cfg.complaintAlertPct) level = "alert";
  }
  return { rate, sent, complaints, level };
}

const ENTITY: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

/** A short plain text preview of an email for the digest row. */
export function excerptOf(html: string | null | undefined, text: string | null | undefined, max = 220): string {
  let s = (text ?? "").trim();
  if (!s && html) {
    s = html
      .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(p|div|tr|li|h\d)>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z#0-9]+;/gi, (m) => ENTITY[m.toLowerCase()] ?? " ");
  }
  s = s.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

const SKIP_LINK = /unsubscribe|preferences|settings\/notifications|settings\/email|mailto:/i;

/** The first real call to action in an email: an http(s) link that is not an unsubscribe or settings link. */
export function primaryLinkOf(html: string | null | undefined): string | null {
  if (!html) return null;
  const re = /href\s*=\s*"(https?:\/\/[^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const url = m[1].replace(/&amp;/g, "&");
    if (!SKIP_LINK.test(url)) return url;
  }
  return null;
}

/** Rate, Ready, Match, Raise index for a journey stage. */
export function stepForStage(stage: string | null | undefined): number {
  switch (stage) {
    case "qualify": return 1;
    case "deploy": return 2;
    case "optimize": return 3;
    default: return 0;
  }
}

export const STEP_NAMES = ["Rate", "Ready", "Match", "Raise"] as const;

/** The one thing to do for each step, with where it lives. */
export function nextStepAction(step: number): { title: string; subtitle: string; label: string; path: string } {
  switch (step) {
    case 1:
      return { title: "Finish the Ready step", subtitle: "Complete your readiness checklist and data room. Once Ready is done, Match opens and investors who fit can see you.", label: "Open my checklist", path: "/founder/readiness" };
    case 2:
      return { title: "Review your investor matches", subtitle: "Investors who fit your raise are waiting in Match. Pick who to approach next.", label: "See my matches", path: "/founder/journey" };
    case 3:
      return { title: "Keep your raise moving", subtitle: "Follow up on open conversations and keep your data room current.", label: "Open my raise", path: "/founder/journey" };
    default:
      return { title: "Finish your Capital Readiness Rating", subtitle: "Your rating tells you what to fix before investors look. It is the first step.", label: "Continue my rating", path: "/founder/journey" };
  }
}
