/**
 * Match campaign follow up sequence. Pure: cohorts, the holdout split, the two
 * behavior branches and the follow up emails. The server runner (followups.ts)
 * loads rows, calls these, and writes the result.
 *
 * Branch A: the founder never opened their match page. Branch B: they opened
 * it but did not request an intro, book a call or start a plan. Opening the
 * page while in Branch A moves the founder to Branch B, timed from the view.
 * Holdout founders (variant "single") get the Day 0 email only.
 */
import { FOUNDER_DISCLAIMER } from "./email";
import { stageLabel } from "./fields";

const DAY = 24 * 60 * 60 * 1000;

// ── Steps ───────────────────────────────────────────────────────────────────

export type FollowupBranch = "a" | "b";
export type FollowupChannel = "email" | "call";
export type FollowupStep = {
  key: "a1" | "a2" | "b1" | "b2" | "b3";
  branch: FollowupBranch;
  channel: FollowupChannel;
  /** Days after the anchor: the Day 0 send for Branch A, the first page view for Branch B. */
  delayDays: number;
  label: string;
};

export const FOLLOWUP_STEPS: readonly FollowupStep[] = [
  { key: "a1", branch: "a", channel: "email", delayDays: 3, label: "Day 3 · your matches are ready" },
  { key: "a2", branch: "a", channel: "email", delayDays: 10, label: "Day 10 · close the loop" },
  { key: "b1", branch: "b", channel: "email", delayDays: 2, label: "View + 2 days · most viewed investor" },
  { key: "b2", branch: "b", channel: "call", delayDays: 3, label: "View + 3 days · call task" },
  { key: "b3", branch: "b", channel: "email", delayDays: 7, label: "View + 7 days · what the plan buys" },
];

export function branchSteps(branch: FollowupBranch): FollowupStep[] {
  return FOLLOWUP_STEPS.filter((s) => s.branch === branch);
}

export type StopReason = "intro_requested" | "booked" | "plan_started" | "replied" | "unsubscribed";

export const STOP_LABEL: Record<StopReason, string> = {
  intro_requested: "Requested an intro",
  booked: "Booked a call",
  plan_started: "Started a plan",
  replied: "Replied",
  unsubscribed: "Unsubscribed",
};

export type FollowupState = {
  sent_at: string | null;
  opened_page_at: string | null;
  clicked_intro_at: string | null;
  booked_at: string | null;
  plan_started_at: string | null;
  replied_at: string | null;
  unsubscribed: boolean;
  followup_branch: FollowupBranch | null;
  /** Steps already done in the current branch. */
  followup_step: number;
};

export type FollowupDecision =
  | { action: "stop"; reason: StopReason }
  | { action: "complete"; branch: FollowupBranch }
  | { action: "wait"; branch: FollowupBranch; stepIndex: number; at: string }
  | { action: "send"; branch: FollowupBranch; stepIndex: number; step: FollowupStep };

export function stopReason(s: FollowupState): StopReason | null {
  if (s.unsubscribed) return "unsubscribed";
  if (s.clicked_intro_at) return "intro_requested";
  if (s.booked_at) return "booked";
  if (s.plan_started_at) return "plan_started";
  if (s.replied_at) return "replied";
  return null;
}

/** What to do for one founder now. Never sends a step before its due time. */
export function decideFollowup(s: FollowupState, now: Date = new Date()): FollowupDecision {
  const stop = stopReason(s);
  if (stop) return { action: "stop", reason: stop };
  const branch: FollowupBranch = s.opened_page_at ? "b" : "a";
  // Switching from A to B starts Branch B from its first step.
  const stepIndex = s.followup_branch === branch ? s.followup_step : 0;
  const steps = branchSteps(branch);
  if (stepIndex >= steps.length) return { action: "complete", branch };
  const step = steps[stepIndex];
  const anchor = branch === "a" ? s.sent_at : s.opened_page_at;
  if (!anchor) return { action: "complete", branch };
  const due = new Date(new Date(anchor).getTime() + step.delayDays * DAY);
  if (due.getTime() > now.getTime()) return { action: "wait", branch, stepIndex, at: due.toISOString() };
  return { action: "send", branch, stepIndex, step };
}

// ── Cohorts and holdout ─────────────────────────────────────────────────────

const LATAM = new Set(
  ["mexico", "brazil", "argentina", "chile", "colombia", "peru", "uruguay", "paraguay", "bolivia", "ecuador", "venezuela", "costa rica", "panama", "guatemala", "honduras", "el salvador", "nicaragua", "dominican republic", "puerto rico", "cuba", "jamaica"],
);
const ASIA = new Set(
  ["china", "japan", "south korea", "korea", "india", "singapore", "hong kong", "taiwan", "indonesia", "malaysia", "thailand", "vietnam", "philippines", "pakistan", "bangladesh", "sri lanka", "united arab emirates", "uae", "saudi arabia", "israel", "qatar", "kazakhstan"],
);

export function regionOf(country: string | null | undefined): string {
  const c = (country ?? "").trim().toLowerCase();
  if (!c) return "Unknown region";
  if (["united states", "united states of america", "usa", "us", "u.s.", "u.s.a."].includes(c)) return "US";
  if (c === "canada") return "Canada";
  if (LATAM.has(c)) return "LatAm";
  if (ASIA.has(c)) return "Asia";
  return "Other";
}

export type CohortInput = { id: string; industry: string | null; funding_stage: string | null; country: string | null };

/** "Fintech · Seed · US"; cohorts over the cap split into numbered parts. */
export function cohortKeys(rows: readonly CohortInput[], cap: number): Map<string, string> {
  const base = new Map<string, CohortInput[]>();
  for (const r of rows) {
    const industry = r.industry?.split(", ")[0]?.trim() || "Unknown industry";
    const stage = r.funding_stage?.split(", ")[0]?.trim();
    const key = [industry, stage ? stageLabel(stage) : "Unknown stage", regionOf(r.country)].join(" · ");
    const list = base.get(key) ?? [];
    list.push(r);
    base.set(key, list);
  }
  const size = Math.max(1, Math.floor(cap));
  const out = new Map<string, string>();
  for (const [key, list] of base) {
    const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
    sorted.forEach((r, i) => out.set(r.id, sorted.length > size ? `${key} · ${Math.floor(i / size) + 1}` : key));
  }
  return out;
}

/** Deterministic 0 to 99 bucket for a founder row id (FNV-1a). */
export function bucketOf(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100;
}

/** Holdout founders get the single Day 0 email; the rest get the sequence. Reruns never reshuffle. */
export function variantFor(id: string, holdoutPct: number): "single" | "sequence" {
  const pct = Math.max(0, Math.min(100, Math.round(holdoutPct)));
  return bucketOf(id) < pct ? "single" : "sequence";
}

// ── Follow up emails ────────────────────────────────────────────────────────

export type FollowupEmailInput = {
  company: string;
  matchCount: number;
  day0MatchCount: number | null;
  /** Most viewed investor, else the top match. Null when the founder has no named match. */
  topInvestor: { name: string; focus: string | null; views: number } | null;
  links: { matches: string; intro: string };
  postalAddress: string;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function button(href: string, text: string): string {
  return `<p style="margin:18px 0 0;"><a href="${esc(href)}" style="display:inline-block;background:#1A6CE4;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px;">${esc(text)}</a></p>`;
}

function wrap(body: string, postal: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0A1A40;font-size:14px;line-height:22px;">
  <p style="margin:0 0 12px;">Hi {first_name},</p>
${body}
  <p style="font-size:12px;color:#8A94A8;margin:24px 0 0;line-height:18px;">${esc(postal)}.<br />${esc(FOUNDER_DISCLAIMER)}</p>
</div>`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Body for an email step; call steps have no email. */
export function renderFollowupEmail(key: FollowupStep["key"], i: FollowupEmailInput): string | null {
  const n = i.matchCount;
  const seeAll = `See my ${n} ${plural(n, "match", "matches")}`;
  const company = esc(i.company);
  switch (key) {
    case "a1": {
      const grew = i.day0MatchCount != null && n > i.day0MatchCount;
      const line = grew
        ? `One more investor matched ${company} since our last note, now ${n}. Your list is ready, no signup needed to view it.`
        : `Your ${n} investor ${plural(n, "match", "matches")} for ${company} ${plural(n, "is", "are")} ready. No signup needed to view ${plural(n, "it", "them")}.`;
      return wrap(`  <p style="margin:0;">${line}</p>\n  ${button(i.links.matches, seeAll)}`, i.postalAddress);
    }
    case "a2":
      return wrap(
        `  <p style="margin:0;">Last note from me. Your ${n} ${plural(n, "match", "matches")} for ${company} stay saved if timing changes.</p>\n  ${button(i.links.matches, seeAll)}`,
        i.postalAddress,
      );
    case "b1": {
      const t = i.topInvestor;
      if (!t) {
        return wrap(
          `  <p style="margin:0;">Thanks for looking at your matches. We can put ${company} in front of the investors on your list this month.</p>\n  ${button(i.links.intro, "Request an intro")}`,
          i.postalAddress,
        );
      }
      const name = esc(t.name);
      const looked =
        t.views >= 3 ? `You looked at ${name}'s profile ${t.views} times.` : t.views === 2 ? `You looked at ${name}'s profile twice.` : t.views === 1 ? `You looked at ${name}'s profile.` : `${name} is your top match.`;
      const focus = t.focus ? ` They back ${esc(t.focus)}.` : "";
      return wrap(
        `  <p style="margin:0;">${looked}${focus} We can put you in front of them this month.</p>\n  ${button(i.links.intro, `Request intro to ${t.name}`)}`,
        i.postalAddress,
      );
    }
    case "b3":
      return wrap(
        `  <p style="margin:0;">Quick math: cold emails to investors get a first meeting about 1 to 2% of the time. Warm intros, 20 to 30%. That is what the plan buys.</p>\n  ${button(i.links.intro, "Choose a plan")}`,
        i.postalAddress,
      );
    default:
      return null;
  }
}

/** Follow ups reply in the Day 0 thread. */
export function followupSubject(day0Subject: string): string {
  return /^re:/i.test(day0Subject.trim()) ? day0Subject : `Re: ${day0Subject}`;
}

export function callTaskText(i: { company: string; matchCount: number; topInvestor: string | null }): { title: string; summary: string } {
  return {
    title: `Match review call · ${i.company}`,
    summary: [
      `Founder viewed their ${i.matchCount} investor ${plural(i.matchCount, "match", "matches")} from a Match campaign and has not requested an intro or booked a call.`,
      i.topInvestor ? `Most viewed investor: ${i.topInvestor}.` : null,
      `Suggested opener: "Saw you reviewed your matches. Which two would you most want a meeting with? I'll tell you how we'd approach them."`,
    ]
      .filter(Boolean)
      .join(" "),
  };
}
