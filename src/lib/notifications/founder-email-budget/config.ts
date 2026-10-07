/**
 * Founder email budget: the admin rules that decide which scheduled emails
 * reach a founder's inbox straight away, which are held for one daily (or
 * weekly) digest, and which are dropped because the founder asked for instant
 * alerts only.
 *
 * Stored as one JSON row in `platform_settings` (key `founder_email_budget`).
 * Every read is defensive: a missing row or table returns the defaults, and the
 * defaults have the rollout at 0%, so nothing changes until an admin turns it on
 * at Admin, System, Scheduled jobs, Founder email.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const BUDGET_SETTINGS_KEY = "founder_email_budget";

/** The job that sends the digest. Never held by the budget itself. */
export const DIGEST_JOB_PATH = "/api/cron/founder-digest";

export type FounderEmailMode = "daily" | "weekly" | "instant";

export type BudgetConfig = {
  /** Share of founders (0 to 100) the rules apply to. 0 = off. */
  rolloutPct: number;
  /** Share of founders (0 to 50) kept on today's behavior for comparison. */
  holdoutPct: number;
  /** Most digest emails a founder can get in one day. */
  dailyCap: number;
  /** Default hour (founder local time) the digest goes out. */
  sendHour: number;
  /** Nothing non instant goes out between these local times. */
  quietStart: string;
  quietEnd: string;
  /** Skip today's digest if the founder used the app in the last N hours. 0 = off. */
  skipActiveHours: number;
  /** Nudges stop after this many reminders for the same subject. */
  maxRemindersPerItem: number;
  /** After this many unopened digests in a row, move the founder down a tier. 0 = off. */
  downshiftAfter: number;
  /** Complaint rate (percent) that raises a warning on the admin page. */
  complaintAlertPct: number;
  /** Complaint rate (percent) that pauses founder digests. */
  complaintPausePct: number;
  /** The pause needs at least this many founder emails in the window, so one complaint on a tiny list cannot stop everything. */
  complaintMinSample: number;
  /** Held items older than this are dropped instead of sent. */
  itemMaxAgeDays: number;
  rules: {
    batchIntoDigest: boolean;
    suppressEmpty: boolean;
    localTime: boolean;
    quietHours: boolean;
    skipIfActive: boolean;
    repeatLimit: boolean;
    autoDownshift: boolean;
    complaintGuard: boolean;
    oneClickUnsubscribe: boolean;
  };
};

export const DEFAULT_BUDGET: BudgetConfig = {
  rolloutPct: 0,
  holdoutPct: 10,
  dailyCap: 1,
  sendHour: 9,
  quietStart: "20:00",
  quietEnd: "08:00",
  skipActiveHours: 24,
  maxRemindersPerItem: 3,
  downshiftAfter: 3,
  complaintAlertPct: 0.1,
  complaintPausePct: 0.3,
  complaintMinSample: 500,
  itemMaxAgeDays: 7,
  rules: {
    batchIntoDigest: true,
    suppressEmpty: true,
    localTime: true,
    quietHours: true,
    skipIfActive: true,
    repeatLimit: true,
    autoDownshift: true,
    complaintGuard: true,
    oneClickUnsubscribe: true,
  },
};

export type JobTier = "instant" | "digest" | "weekly" | "none";

/**
 * Where each founder facing job delivers once the rules apply. Jobs not listed
 * are never touched (meeting reminders, billing, transactional mail, staff mail).
 */
export const JOB_DELIVERY: Array<{ path: string; name: string; tier: JobTier; note: string }> = [
  { path: "/api/cron/scheduled-reach-outs", name: "Scheduled reach outs", tier: "instant", note: "Founder picked the send time" },
  { path: "/api/cron/founder-nudges", name: "Founder nudges", tier: "digest", note: "Held for the digest; repeats of the same reminder stop after the limit" },
  { path: "/api/cron/ir-summaries", name: "Founder summaries", tier: "digest", note: "Held for the digest" },
  { path: "/api/cron/run-orchestration", name: "Orchestration (match notices)", tier: "digest", note: "Founder emails held for the digest; investor sends unchanged" },
  { path: "/api/cron/intro-follow-ups", name: "Intro follow ups", tier: "digest", note: "Founder side held; investor side unchanged" },
  { path: "/api/cron/activity-escalations", name: "Activity escalations", tier: "digest", note: "Founder emails held for the digest" },
  { path: "/api/cron/founder-match-digest", name: "Weekly match email", tier: "weekly", note: "Unchanged, except founders on instant alerts only" },
  { path: "/api/cron/ir-sequences", name: "Investor Relations auto sequences", tier: "none", note: "Investors only, no change" },
];

const DIGEST_PATHS = new Set(JOB_DELIVERY.filter((j) => j.tier === "digest").map((j) => j.path));
const WEEKLY_PATHS = new Set(JOB_DELIVERY.filter((j) => j.tier === "weekly").map((j) => j.path));

export function jobTier(path: string | null | undefined): JobTier | null {
  if (!path) return null;
  if (DIGEST_PATHS.has(path)) return "digest";
  if (WEEKLY_PATHS.has(path)) return "weekly";
  return null;
}

function num(v: unknown, fallback: number, min: number, max: number, round = true): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const c = Math.min(max, Math.max(min, n));
  return round ? Math.round(c) : Math.round(c * 100) / 100;
}

function hhmm(v: unknown, fallback: string): string {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback;
}

/** Fill gaps and clamp every value, so a hand edited row can never break sending. */
export function normalizeBudget(raw: unknown): BudgetConfig {
  const v = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const r = (v.rules && typeof v.rules === "object" ? v.rules : {}) as Record<string, unknown>;
  const holdoutPct = num(v.holdoutPct, DEFAULT_BUDGET.holdoutPct, 0, 50);
  const rules = { ...DEFAULT_BUDGET.rules };
  for (const key of Object.keys(rules) as Array<keyof BudgetConfig["rules"]>) {
    if (typeof r[key] === "boolean") rules[key] = r[key] as boolean;
  }
  const alert = num(v.complaintAlertPct, DEFAULT_BUDGET.complaintAlertPct, 0.01, 5, false);
  return {
    rolloutPct: num(v.rolloutPct, DEFAULT_BUDGET.rolloutPct, 0, 100 - holdoutPct),
    holdoutPct,
    dailyCap: num(v.dailyCap, DEFAULT_BUDGET.dailyCap, 1, 3),
    sendHour: num(v.sendHour, DEFAULT_BUDGET.sendHour, 0, 23),
    quietStart: hhmm(v.quietStart, DEFAULT_BUDGET.quietStart),
    quietEnd: hhmm(v.quietEnd, DEFAULT_BUDGET.quietEnd),
    skipActiveHours: num(v.skipActiveHours, DEFAULT_BUDGET.skipActiveHours, 0, 168),
    maxRemindersPerItem: num(v.maxRemindersPerItem, DEFAULT_BUDGET.maxRemindersPerItem, 1, 20),
    downshiftAfter: num(v.downshiftAfter, DEFAULT_BUDGET.downshiftAfter, 0, 20),
    complaintAlertPct: alert,
    complaintPausePct: Math.max(alert, num(v.complaintPausePct, DEFAULT_BUDGET.complaintPausePct, 0.01, 5, false)),
    complaintMinSample: num(v.complaintMinSample, DEFAULT_BUDGET.complaintMinSample, 1, 100000),
    itemMaxAgeDays: num(v.itemMaxAgeDays, DEFAULT_BUDGET.itemMaxAgeDays, 1, 30),
    rules,
  };
}

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

// One read per process per minute: the gate runs on every send inside a job.
let cached: { at: number; value: BudgetConfig } | null = null;
const CACHE_MS = 60_000;

export async function loadBudgetConfig(opts: { fresh?: boolean } = {}): Promise<BudgetConfig> {
  if (!opts.fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  let value = { ...DEFAULT_BUDGET, rules: { ...DEFAULT_BUDGET.rules } };
  try {
    const { data } = await db().from("platform_settings").select("value").eq("key", BUDGET_SETTINGS_KEY).maybeSingle();
    const raw = (data as { value?: unknown } | null)?.value;
    if (raw) value = normalizeBudget(raw);
  } catch {
    // defaults
  }
  cached = { at: Date.now(), value };
  return value;
}

export async function saveBudgetConfig(input: unknown, updatedBy: string | null): Promise<BudgetConfig | null> {
  const clean = normalizeBudget(input);
  try {
    const { error } = await db()
      .from("platform_settings")
      .upsert(
        { key: BUDGET_SETTINGS_KEY, value: clean, updated_by: updatedBy, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) return null;
    cached = { at: Date.now(), value: clean };
    return clean;
  } catch {
    return null;
  }
}
