import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { DEFAULT_WEIGHTS, type MatchWeights } from "@/lib/investors/preference-match";

/**
 * Small key-value store for platform-level settings that admins toggle at
 * runtime (as opposed to build-time env vars). Backed by the `platform_settings`
 * table; every read/write is defensive so a missing table never breaks a page.
 */

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

const AUTOMATION_KEY = "investor_outreach_automation";

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
  };
  minMatch: number;
  minInvestorScore: number;
  /** When true, unrated ("New") investors don't qualify for outreach. */
  requireRated: boolean;
  /** Weight of each graded match factor (sum is the score denominator). */
  weights: MatchWeights;
};

export const DEFAULT_MATCH_CONFIG: InvestorMatchConfig = {
  requiredFields: { industry: true, checkSize: false, revenueStage: false, useOfFunds: false, geography: false, activeRating: false },
  minMatch: 60,
  minInvestorScore: 50,
  requireRated: false,
  weights: DEFAULT_WEIGHTS,
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
