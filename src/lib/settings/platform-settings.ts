import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { DEFAULT_WEIGHTS, type MatchWeights } from "@/lib/investors/preference-match";
import { DEFAULT_ENGINE_WEIGHTS, type EngineWeights } from "@/lib/matching/investor-company-matching";

/**
 * Small key-value store for platform-level settings that admins toggle at
 * runtime (as opposed to build-time env vars). Backed by the `platform_settings`
 * table; every read/write is defensive so a missing table never breaks a page.
 */

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

const AUTOMATION_KEY = "investor_outreach_automation";
const FOUNDER_STAGE_MENU_KEY = "founder_stage_menu";
const UPLOAD_LIMITS_KEY = "upload_limits";

/** Founder document-upload limits (admin-editable). Applies to all founder uploads. */
export type UploadLimits = { maxMb: number; maxPages: number };
export const DEFAULT_UPLOAD_LIMITS: UploadLimits = { maxMb: 20, maxPages: 30 };
// Hard ceilings we never let an admin exceed (Anthropic's PDF caps).
export const UPLOAD_LIMIT_CEILING: UploadLimits = { maxMb: 32, maxPages: 100 };

function clampLimits(v: Partial<UploadLimits> | null | undefined): UploadLimits {
  const mb = Number(v?.maxMb);
  const pages = Number(v?.maxPages);
  return {
    maxMb: Number.isFinite(mb) ? Math.min(UPLOAD_LIMIT_CEILING.maxMb, Math.max(1, Math.round(mb))) : DEFAULT_UPLOAD_LIMITS.maxMb,
    maxPages: Number.isFinite(pages) ? Math.min(UPLOAD_LIMIT_CEILING.maxPages, Math.max(1, Math.round(pages))) : DEFAULT_UPLOAD_LIMITS.maxPages,
  };
}

export async function getUploadLimits(): Promise<UploadLimits> {
  try {
    const { data } = await db()
      .from("platform_settings")
      .select("value")
      .eq("key", UPLOAD_LIMITS_KEY)
      .maybeSingle();
    const value = (data as { value?: Partial<UploadLimits> } | null)?.value;
    return value ? clampLimits(value) : { ...DEFAULT_UPLOAD_LIMITS };
  } catch {
    return { ...DEFAULT_UPLOAD_LIMITS };
  }
}

export async function setUploadLimits(limits: Partial<UploadLimits>, updatedBy: string | null): Promise<UploadLimits | null> {
  const clean = clampLimits(limits);
  try {
    const { error } = await db()
      .from("platform_settings")
      .upsert(
        { key: UPLOAD_LIMITS_KEY, value: clean, updated_by: updatedBy, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    return error ? null : clean;
  } catch {
    return null;
  }
}

/** Founder-nav menu hrefs hidden per the admin stage-menu editor (global). */
export async function getFounderStageMenuHidden(): Promise<string[]> {
  try {
    const { data } = await db()
      .from("platform_settings")
      .select("value")
      .eq("key", FOUNDER_STAGE_MENU_KEY)
      .maybeSingle();
    const hidden = (data as { value?: { hidden?: unknown } } | null)?.value?.hidden;
    return Array.isArray(hidden) ? hidden.filter((h): h is string => typeof h === "string") : [];
  } catch {
    return [];
  }
}

export async function setFounderStageMenuHidden(hidden: string[], updatedBy: string | null): Promise<boolean> {
  try {
    const clean = [...new Set(hidden.filter((h) => typeof h === "string" && h.startsWith("/")))];
    const { error } = await db()
      .from("platform_settings")
      .upsert(
        { key: FOUNDER_STAGE_MENU_KEY, value: { hidden: clean }, updated_by: updatedBy, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    return !error;
  } catch {
    return false;
  }
}

/** Read a boolean setting; returns `fallback` if unset or unreadable. */
export async function getBoolSetting(key: string, fallback = false): Promise<boolean> {
  try {
    const { data } = await db()
      .from("platform_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    const value = (data as { value?: { enabled?: boolean } } | null)?.value;
    if (value && typeof value.enabled === "boolean") return value.enabled;
    return fallback;
  } catch {
    return fallback;
  }
}

/** Write a boolean setting, attributing the change to an admin user. */
export async function setBoolSetting(key: string, enabled: boolean, updatedBy: string | null): Promise<boolean> {
  try {
    const { error } = await db()
      .from("platform_settings")
      .upsert(
        { key, value: { enabled }, updated_by: updatedBy, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    return !error;
  } catch {
    return false;
  }
}

/**
 * Investor-outreach automation master switch. When ON, approved (and
 * auto-approved) campaigns dispatch real Founder-Preview emails on the weekly
 * pass. The build-time env var stays as an override for staging.
 */
export async function getOutreachAutomationEnabled(): Promise<boolean> {
  if (process.env.INVESTOR_OUTREACH_LIVE === "true") return true;
  return getBoolSetting(AUTOMATION_KEY, false);
}

export async function setOutreachAutomationEnabled(enabled: boolean, updatedBy: string | null): Promise<boolean> {
  return setBoolSetting(AUTOMATION_KEY, enabled, updatedBy);
}

/**
 * Founder 4-step nav (V2) cohort rollout — percentage of founders (0–100)
 * bucketed into the new nav when no explicit `founder:nav_v2` master switch is
 * set. Bucketing is deterministic per founder (see the feature-controls API), so
 * a founder never flips back and forth. 0 = off (build-flag fallback applies).
 */
const NAV_V2_ROLLOUT_KEY = "founder_nav_v2_rollout";

export async function getFounderNavV2RolloutPct(): Promise<number> {
  try {
    const { data } = await db().from("platform_settings").select("value").eq("key", NAV_V2_ROLLOUT_KEY).maybeSingle();
    const pct = (data as { value?: { pct?: number } } | null)?.value?.pct;
    if (typeof pct !== "number" || Number.isNaN(pct)) return 0;
    return Math.max(0, Math.min(100, Math.round(pct)));
  } catch {
    return 0;
  }
}

export async function setFounderNavV2RolloutPct(pct: number, updatedBy: string | null): Promise<boolean> {
  const clamped = Math.max(0, Math.min(100, Math.round(Number.isFinite(pct) ? pct : 0)));
  try {
    const { error } = await db()
      .from("platform_settings")
      .upsert(
        { key: NAV_V2_ROLLOUT_KEY, value: { pct: clamped }, updated_by: updatedBy, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    return !error;
  } catch {
    return false;
  }
}

/**
 * Investor match & outreach-qualification rules (admin Control Features).
 * `requiredFields` — a field flagged here must match or the investor is excluded
 * from matches entirely (industry is always required). Thresholds gate who is
 * queued for automated outreach.
 */
export type InvestorMatchConfig = {
  requiredFields: {
    industry: boolean;
    checkSize: boolean;
    revenueStage: boolean;
    useOfFunds: boolean;
    geography: boolean;
    activeRating: boolean;
    investorType: boolean;
    capitalType: boolean;
  };
  minMatch: number;
  minInvestorScore: number;
  /** When true, unrated ("New") investors don't qualify for outreach. */
  requireRated: boolean;
  /** Legacy preference-scorer weights (still used by the /admin/sales match pages). */
  weights: MatchWeights;
  /** Live matching-engine weights — the four tunable investor-fit factors. */
  engineWeights: EngineWeights;
};

export const DEFAULT_MATCH_CONFIG: InvestorMatchConfig = {
  requiredFields: { industry: true, checkSize: false, revenueStage: false, useOfFunds: false, geography: false, activeRating: false, investorType: false, capitalType: false },
  minMatch: 30,
  minInvestorScore: 50,
  requireRated: false,
  weights: DEFAULT_WEIGHTS,
  engineWeights: DEFAULT_ENGINE_WEIGHTS,
};

const MATCH_CONFIG_KEY = "investor_match_config";

export async function getInvestorMatchConfig(): Promise<InvestorMatchConfig> {
  try {
    const { data } = await db().from("platform_settings").select("value").eq("key", MATCH_CONFIG_KEY).maybeSingle();
    const v = (data as { value?: Partial<InvestorMatchConfig> } | null)?.value;
    if (!v) return DEFAULT_MATCH_CONFIG;
    return {
      minMatch: typeof v.minMatch === "number" ? v.minMatch : DEFAULT_MATCH_CONFIG.minMatch,
      minInvestorScore: typeof v.minInvestorScore === "number" ? v.minInvestorScore : DEFAULT_MATCH_CONFIG.minInvestorScore,
      requireRated: typeof v.requireRated === "boolean" ? v.requireRated : DEFAULT_MATCH_CONFIG.requireRated,
      weights: { ...DEFAULT_WEIGHTS, ...(v.weights ?? {}) },
      engineWeights: { ...DEFAULT_ENGINE_WEIGHTS, ...(v.engineWeights ?? {}) },
      // Industry is always required (locked on).
      requiredFields: { ...DEFAULT_MATCH_CONFIG.requiredFields, ...(v.requiredFields ?? {}), industry: true },
    };
  } catch {
    return DEFAULT_MATCH_CONFIG;
  }
}

export async function setInvestorMatchConfig(cfg: InvestorMatchConfig, updatedBy: string | null): Promise<boolean> {
  try {
    const value: InvestorMatchConfig = { ...cfg, requiredFields: { ...cfg.requiredFields, industry: true } };
    const { error } = await db()
      .from("platform_settings")
      .upsert({ key: MATCH_CONFIG_KEY, value, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "key" });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Editable outreach message (admin). Subject / intro / closing are admin-edited
 * copy with {{company}} / {{investor}} / {{stage}} / {{sector}} merge fields; the
 * one-pager card and the legal disclaimer are fixed and added at render time.
 */
export type OutreachMessage = { subject: string; intro: string; closing: string };

export const DEFAULT_OUTREACH_MESSAGE: OutreachMessage = {
  subject: "{{company}} — a Founder Preview that fits your focus",
  intro: "Hi {{investor}},\n\nOur fit scoring matched {{company}} to your stated preferences. Here's their Founder Preview — no obligation.",
  closing: "If it's a fit, simply reply and we'll make the introduction. If not, no action is needed.",
};

const OUTREACH_MESSAGE_KEY = "investor_outreach_message";

export async function getOutreachMessage(): Promise<OutreachMessage> {
  try {
    const { data } = await db().from("platform_settings").select("value").eq("key", OUTREACH_MESSAGE_KEY).maybeSingle();
    const v = (data as { value?: Partial<OutreachMessage> } | null)?.value;
    if (!v) return DEFAULT_OUTREACH_MESSAGE;
    return {
      subject: typeof v.subject === "string" && v.subject.trim() ? v.subject : DEFAULT_OUTREACH_MESSAGE.subject,
      intro: typeof v.intro === "string" && v.intro.trim() ? v.intro : DEFAULT_OUTREACH_MESSAGE.intro,
      closing: typeof v.closing === "string" ? v.closing : DEFAULT_OUTREACH_MESSAGE.closing,
    };
  } catch {
    return DEFAULT_OUTREACH_MESSAGE;
  }
}

export async function setOutreachMessage(msg: OutreachMessage, updatedBy: string | null): Promise<boolean> {
  try {
    const { error } = await db()
      .from("platform_settings")
      .upsert({ key: OUTREACH_MESSAGE_KEY, value: msg, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "key" });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Founder outreach automation (admin). Monthly send caps come from each founder's
 * subscription plan; the schedule + pause apply platform-wide. Per-founder
 * overrides layer on top of this via founder_outreach_overrides.
 */
export type SendCadence = "weekly" | "daily";
export type AutomationConfig = {
  /** Monthly introduction cap per subscription tier. */
  monthlyByPlan: { basic: number; professional: number };
  /** Nothing sends before this date (ISO yyyy-mm-dd); null = start immediately. */
  startDate: string | null;
  cadence: SendCadence;
  /** Soft, time-boxed halt of ALL founder sends (distinct from the master switch). */
  pause: { enabled: boolean; until: string | null };
};

export const DEFAULT_AUTOMATION_CONFIG: AutomationConfig = {
  monthlyByPlan: { basic: 25, professional: 100 },
  startDate: null,
  cadence: "weekly",
  pause: { enabled: false, until: null },
};

const AUTOMATION_CONFIG_KEY = "investor_automation_config";

export async function getAutomationConfig(): Promise<AutomationConfig> {
  try {
    const { data } = await db().from("platform_settings").select("value").eq("key", AUTOMATION_CONFIG_KEY).maybeSingle();
    const v = (data as { value?: Partial<AutomationConfig> } | null)?.value;
    if (!v) return DEFAULT_AUTOMATION_CONFIG;
    const mbp = (v.monthlyByPlan ?? {}) as Partial<AutomationConfig["monthlyByPlan"]>;
    const pause = (v.pause ?? {}) as Partial<AutomationConfig["pause"]>;
    return {
      monthlyByPlan: {
        basic: typeof mbp.basic === "number" ? mbp.basic : DEFAULT_AUTOMATION_CONFIG.monthlyByPlan.basic,
        professional: typeof mbp.professional === "number" ? mbp.professional : DEFAULT_AUTOMATION_CONFIG.monthlyByPlan.professional,
      },
      startDate: typeof v.startDate === "string" && v.startDate ? v.startDate : null,
      cadence: v.cadence === "daily" ? "daily" : "weekly",
      pause: {
        enabled: typeof pause.enabled === "boolean" ? pause.enabled : false,
        until: typeof pause.until === "string" && pause.until ? pause.until : null,
      },
    };
  } catch {
    return DEFAULT_AUTOMATION_CONFIG;
  }
}

export async function setAutomationConfig(cfg: AutomationConfig, updatedBy: string | null): Promise<boolean> {
  try {
    const { error } = await db()
      .from("platform_settings")
      .upsert({ key: AUTOMATION_CONFIG_KEY, value: cfg, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "key" });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Founder-initiated investor connection requests — monthly cap per subscription
 * plan. Distinct from AutomationConfig (which caps platform-initiated intros):
 * this caps how many intro/connect requests a founder may SEND per calendar
 * month. Trial + basic use the `basic` cap; professional uses `professional`.
 */
export type FounderConnectionConfig = {
  monthlyByPlan: { basic: number; professional: number };
};

export const DEFAULT_FOUNDER_CONNECTION_CONFIG: FounderConnectionConfig = {
  monthlyByPlan: { basic: 5, professional: 20 },
};

const FOUNDER_CONNECTION_CONFIG_KEY = "founder_connection_config";

export async function getFounderConnectionConfig(): Promise<FounderConnectionConfig> {
  try {
    const { data } = await db().from("platform_settings").select("value").eq("key", FOUNDER_CONNECTION_CONFIG_KEY).maybeSingle();
    const v = (data as { value?: Partial<FounderConnectionConfig> } | null)?.value;
    const mbp = (v?.monthlyByPlan ?? {}) as Partial<FounderConnectionConfig["monthlyByPlan"]>;
    return {
      monthlyByPlan: {
        basic: typeof mbp.basic === "number" ? mbp.basic : DEFAULT_FOUNDER_CONNECTION_CONFIG.monthlyByPlan.basic,
        professional: typeof mbp.professional === "number" ? mbp.professional : DEFAULT_FOUNDER_CONNECTION_CONFIG.monthlyByPlan.professional,
      },
    };
  } catch {
    return DEFAULT_FOUNDER_CONNECTION_CONFIG;
  }
}

export async function setFounderConnectionConfig(cfg: FounderConnectionConfig, updatedBy: string | null): Promise<boolean> {
  try {
    const { error } = await db()
      .from("platform_settings")
      .upsert({ key: FOUNDER_CONNECTION_CONFIG_KEY, value: cfg, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "key" });
    return !error;
  } catch {
    return false;
  }
}
