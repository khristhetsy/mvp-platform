import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  listOutreachCampaigns,
  getCampaignRecipients,
  type OutreachCampaign,
} from "@/lib/outreach/investor-outreach";
import {
  getOutreachAutomationEnabled,
  setOutreachAutomationEnabled,
  getInvestorMatchConfig,
  setInvestorMatchConfig,
  DEFAULT_MATCH_CONFIG,
  type InvestorMatchConfig,
  getOutreachMessage,
  setOutreachMessage,
  DEFAULT_OUTREACH_MESSAGE,
  type OutreachMessage,
  getAutomationConfig,
  setAutomationConfig,
  DEFAULT_AUTOMATION_CONFIG,
  type AutomationConfig,
  getFounderConnectionConfig,
  setFounderConnectionConfig,
  DEFAULT_FOUNDER_CONNECTION_CONFIG,
  type FounderConnectionConfig,
} from "@/lib/settings/platform-settings";
import { resolveFounderOutreachConfig, loadOutreachGlobals } from "@/lib/outreach/founder-overrides";

export const dynamic = "force-dynamic";

/**
 * Staff gate for investor-outreach routes: resolves the signed-in user, reads
 * their `profiles.role`, and allows only `admin` or `analyst`. Returns the
 * user id on success (needed to attribute approvals) or a JSON error Response.
 */
async function requireStaff(): Promise<
  { userId: string } | { error: Response }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "analyst")) {
    return { error: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  }

  return { userId: user.id };
}

export type OutreachCampaignSummary = OutreachCampaign & {
  companyName: string;
  audienceCount: number;
  queuedCount: number;
  sentCount: number;
  /** Founder's subscription plan (e.g. "founder_professional") or null. */
  planType: string | null;
  /** Effective monthly send cap (plan-derived or per-founder override). */
  monthlyCap: number;
  /** Introductions sent to this campaign so far this calendar month. */
  sentThisMonth: number;
  /** Whether this founder has any per-founder override. */
  customized: boolean;
};

// GET — list all outreach campaigns enriched with company name + recipient counts.
export async function GET(): Promise<Response> {
  const gate = await requireStaff();
  if ("error" in gate) return gate.error;

  const campaigns = await listOutreachCampaigns();
  const admin = createServiceRoleClient() as unknown as SupabaseClient;

  const monthStart = (() => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); })();
  // Global config rows are identical for every campaign — load once, reuse.
  const globals = await loadOutreachGlobals();

  const summaries = await Promise.all(
    campaigns.map(async (campaign): Promise<OutreachCampaignSummary> => {
      const recipients = await getCampaignRecipients(campaign.id);
      const queuedCount = recipients.filter((r) => r.status === "queued").length;
      const sentCount = recipients.filter((r) => r.status === "sent").length;
      const sentThisMonth = recipients.filter((r) => r.status === "sent" && r.sent_at && r.sent_at >= monthStart).length;

      const { data: company } = await admin
        .from("companies")
        .select("company_name, founder_id")
        .eq("id", campaign.company_id)
        .maybeSingle();
      const comp = company as { company_name?: string | null; founder_id?: string | null } | null;
      const companyName = comp?.company_name ?? "Unknown company";

      let planType: string | null = null;
      let monthlyCap = 0;
      let customized = false;
      if (comp?.founder_id) {
        const eff = await resolveFounderOutreachConfig({ id: campaign.company_id, founder_id: comp.founder_id }, globals);
        planType = eff.planType;
        monthlyCap = eff.monthlyCap;
        customized = eff.customized.match || eff.customized.automation || eff.customized.message;
      }

      return {
        ...campaign,
        companyName,
        audienceCount: recipients.length,
        queuedCount,
        sentCount,
        planType,
        monthlyCap,
        sentThisMonth,
        customized,
      };
    }),
  );

  const [liveSend, matchConfig, message, automation, connection] = await Promise.all([
    getOutreachAutomationEnabled(),
    getInvestorMatchConfig(),
    getOutreachMessage(),
    getAutomationConfig(),
    getFounderConnectionConfig(),
  ]);
  return NextResponse.json({ campaigns: summaries, liveSend, matchConfig, message, automation, connection });
}

// PATCH — automation switch, or the match/qualification control config.
export async function PATCH(req: Request): Promise<Response> {
  const gate = await requireStaff();
  if ("error" in gate) return gate.error;

  const body = (await req.json().catch(() => null)) as
    | { action?: string; enabled?: unknown; config?: unknown }
    | null;

  if (body?.action === "set_automation" && typeof body.enabled === "boolean") {
    const ok = await setOutreachAutomationEnabled(body.enabled, gate.userId);
    return NextResponse.json({ ok, liveSend: body.enabled });
  }

  if (body?.action === "set_match_config" && body.config && typeof body.config === "object") {
    const c = body.config as Partial<InvestorMatchConfig>;
    const clampScore = (n: unknown, d: number) => (typeof n === "number" && n >= 0 && n <= 100 ? Math.round(n) : d);
    const w = (c.weights ?? {}) as Partial<InvestorMatchConfig["weights"]>;
    const dw = DEFAULT_MATCH_CONFIG.weights;
    const ew = (c.engineWeights ?? {}) as Partial<InvestorMatchConfig["engineWeights"]>;
    const dew = DEFAULT_MATCH_CONFIG.engineWeights;
    const config: InvestorMatchConfig = {
      requiredFields: { ...DEFAULT_MATCH_CONFIG.requiredFields, ...(c.requiredFields ?? {}), industry: true },
      minMatch: clampScore(c.minMatch, DEFAULT_MATCH_CONFIG.minMatch),
      minInvestorScore: clampScore(c.minInvestorScore, DEFAULT_MATCH_CONFIG.minInvestorScore),
      requireRated: typeof c.requireRated === "boolean" ? c.requireRated : DEFAULT_MATCH_CONFIG.requireRated,
      weights: {
        sector: clampScore(w.sector, dw.sector),
        specificity: clampScore(w.specificity, dw.specificity),
        stage: clampScore(w.stage, dw.stage),
        checkSize: clampScore(w.checkSize, dw.checkSize),
        revenue: clampScore(w.revenue, dw.revenue),
        activity: clampScore(w.activity, dw.activity),
      },
      engineWeights: {
        sector: clampScore(ew.sector, dew.sector),
        stage: clampScore(ew.stage, dew.stage),
        checkSize: clampScore(ew.checkSize, dew.checkSize),
        geography: clampScore(ew.geography, dew.geography),
        investorType: clampScore(ew.investorType, dew.investorType),
        capitalType: clampScore(ew.capitalType, dew.capitalType),
        activeRating: clampScore(ew.activeRating, dew.activeRating),
      },
    };
    const ok = await setInvestorMatchConfig(config, gate.userId);
    return NextResponse.json({ ok, matchConfig: config });
  }

  if (body?.action === "set_automation_config" && body.config && typeof body.config === "object") {
    const c = body.config as Partial<AutomationConfig>;
    const clampCap = (n: unknown, d: number) => (typeof n === "number" && n >= 0 && n <= 100000 ? Math.round(n) : d);
    const isoDate = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    const mbp = (c.monthlyByPlan ?? {}) as Partial<AutomationConfig["monthlyByPlan"]>;
    const pause = (c.pause ?? {}) as Partial<AutomationConfig["pause"]>;
    const config: AutomationConfig = {
      monthlyByPlan: {
        basic: clampCap(mbp.basic, DEFAULT_AUTOMATION_CONFIG.monthlyByPlan.basic),
        professional: clampCap(mbp.professional, DEFAULT_AUTOMATION_CONFIG.monthlyByPlan.professional),
      },
      startDate: isoDate(c.startDate),
      cadence: c.cadence === "daily" ? "daily" : "weekly",
      pause: { enabled: pause.enabled === true, until: isoDate(pause.until) },
    };
    const ok = await setAutomationConfig(config, gate.userId);
    return NextResponse.json({ ok, automation: config });
  }

  if (body?.action === "set_connection_config" && body.config && typeof body.config === "object") {
    const c = body.config as Partial<FounderConnectionConfig>;
    const clampCap = (n: unknown, d: number) => (typeof n === "number" && n >= 0 && n <= 100000 ? Math.round(n) : d);
    const mbp = (c.monthlyByPlan ?? {}) as Partial<FounderConnectionConfig["monthlyByPlan"]>;
    const config: FounderConnectionConfig = {
      monthlyByPlan: {
        basic: clampCap(mbp.basic, DEFAULT_FOUNDER_CONNECTION_CONFIG.monthlyByPlan.basic),
        professional: clampCap(mbp.professional, DEFAULT_FOUNDER_CONNECTION_CONFIG.monthlyByPlan.professional),
      },
    };
    const ok = await setFounderConnectionConfig(config, gate.userId);
    return NextResponse.json({ ok, connection: config });
  }

  if (body?.action === "set_message" && body.config && typeof body.config === "object") {
    const m = body.config as Partial<OutreachMessage>;
    const str = (v: unknown, d: string, max = 4000) => (typeof v === "string" ? v.slice(0, max) : d);
    const message: OutreachMessage = {
      subject: str(m.subject, DEFAULT_OUTREACH_MESSAGE.subject, 300).trim() || DEFAULT_OUTREACH_MESSAGE.subject,
      intro: str(m.intro, DEFAULT_OUTREACH_MESSAGE.intro),
      closing: str(m.closing, DEFAULT_OUTREACH_MESSAGE.closing),
    };
    const ok = await setOutreachMessage(message, gate.userId);
    return NextResponse.json({ ok, message });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
