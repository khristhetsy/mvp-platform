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
} from "@/lib/settings/platform-settings";

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
};

// GET — list all outreach campaigns enriched with company name + recipient counts.
export async function GET(): Promise<Response> {
  const gate = await requireStaff();
  if ("error" in gate) return gate.error;

  const campaigns = await listOutreachCampaigns();
  const admin = createServiceRoleClient() as unknown as SupabaseClient;

  const summaries = await Promise.all(
    campaigns.map(async (campaign): Promise<OutreachCampaignSummary> => {
      const recipients = await getCampaignRecipients(campaign.id);
      const queuedCount = recipients.filter((r) => r.status === "queued").length;
      const sentCount = recipients.filter((r) => r.status === "sent").length;

      const { data: company } = await admin
        .from("companies")
        .select("company_name")
        .eq("id", campaign.company_id)
        .maybeSingle();
      const companyName =
        (company as { company_name?: string | null } | null)?.company_name ?? "Unknown company";

      return {
        ...campaign,
        companyName,
        audienceCount: recipients.length,
        queuedCount,
        sentCount,
      };
    }),
  );

  const [liveSend, matchConfig, message] = await Promise.all([
    getOutreachAutomationEnabled(),
    getInvestorMatchConfig(),
    getOutreachMessage(),
  ]);
  return NextResponse.json({ campaigns: summaries, liveSend, matchConfig, message });
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
        activity: clampScore(w.activity, dw.activity),
      },
    };
    const ok = await setInvestorMatchConfig(config, gate.userId);
    return NextResponse.json({ ok, matchConfig: config });
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
