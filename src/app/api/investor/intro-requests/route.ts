import { NextResponse } from "next/server";
import { requireInvestorApprovedApi } from "@/lib/api/investor";
import { writeAuditLog } from "@/lib/data/audit";
import { recordInvestorCrmActivity } from "@/lib/data/investor-crm";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { createIntroRequest } from "@/lib/data/investor-interests";
import { emitActivity } from "@/lib/activity/emit";
import { openMessageThreadFromSignal } from "@/lib/messaging/open-thread-from-signal";
import { notifyFounderInvestorIntro } from "@/lib/notifications/investor-events";
import { investorIntroRequestSchema } from "@/lib/validation";
import { notifyCompanyFounder } from "@/lib/notifications/notifications";
import { getSubscription } from "@/lib/subscriptions/get-subscription";
import { masksInvestorInterest } from "@/lib/founder-plan/tier";
import {
  MASKED_INTRO_DEEP_LINK,
  MASKED_INTRO_MESSAGE,
  introRuleForFounderPlan,
  introRuleForMasked,
  isPrivateMarketListed,
} from "@/lib/listing/private-market";
import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type IntroRow = Database["public"]["Tables"]["intro_requests"]["Row"];

/**
 * Private Market companies (diligence complete and opted in) are not marketplace
 * campaigns, so the marketplace resolver rejects them as "not listed". For
 * those, the request is written directly under the investor's own session (the
 * intro_requests insert policy still applies), with no campaign.
 */
async function createPrivateMarketIntro(
  supabase: SupabaseClient<Database>,
  input: { investorId: string; companyId: string; message: string | null },
): Promise<{ data: IntroRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("intro_requests")
    .insert({
      investor_id: input.investorId,
      company_id: input.companyId,
      campaign_id: null,
      message: input.message,
      status: "requested",
    })
    .select("*")
    .single();
  return { data: (data as IntroRow | null) ?? null, error: error?.message ?? null };
}

/** The founder's plan decides whether this request is masked and expires. */
async function founderIntroRule(serviceSupabase: SupabaseClient<Database>, companyId: string) {
  try {
    const { data: company } = await serviceSupabase.from("companies").select("founder_id").eq("id", companyId).maybeSingle();
    const founderId = (company as { founder_id: string | null } | null)?.founder_id ?? null;
    if (!founderId) return introRuleForFounderPlan(null);
    // One rule with the founder's investor interest page: unpaid, lapsed and
    // Free founders see the request without the investor's name.
    const subscription = await getSubscription(founderId);
    return introRuleForMasked(masksInvestorInterest(subscription));
  } catch {
    // Unknown plan: keep today's behavior rather than hide or expire a request.
    return introRuleForFounderPlan(null);
  }
}

export async function POST(request: Request) {
  const auth = await requireInvestorApprovedApi();

  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = investorIntroRequestSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid intro request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const result = await createIntroRequest(
    { supabase: auth.supabase, serviceSupabase: auth.serviceSupabase },
    {
      investorId: auth.profile.id,
      companyId: parsed.data.companyId,
      companySlug: parsed.data.companySlug,
      message: parsed.data.message,
    },
  );

  let data: IntroRow | null = null;
  if ("error" in result && result.error) {
    const code = "code" in result.error ? String(result.error.code ?? "") : "";
    const companyId = parsed.data.companyId;
    if (code === "deal_not_listed" && companyId && (await isPrivateMarketListed(companyId, auth.serviceSupabase))) {
      const direct = await createPrivateMarketIntro(auth.supabase, {
        investorId: auth.profile.id,
        companyId,
        message: parsed.data.message ?? null,
      });
      if (direct.error || !direct.data) {
        return NextResponse.json({ error: direct.error ?? "Unable to save intro request." }, { status: 400 });
      }
      data = direct.data;
    } else {
      const message = "message" in result.error ? result.error.message : "Unable to save intro request.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } else {
    data = "data" in result ? (result.data as IntroRow | null) : null;
  }

  if (!data) {
    return NextResponse.json({ error: "Unable to save intro request." }, { status: 400 });
  }

  // Free and trial founders: the request expires after 14 days and the founder
  // is told an investor asked, without the investor's name, until they upgrade.
  const rule = data.company_id ? await founderIntroRule(auth.serviceSupabase, data.company_id) : introRuleForFounderPlan(null);
  let expiresAt: string | null = null;
  if (rule.masked && rule.expiresAt) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- expires_at is not in the generated types yet
    const { error: expiryError } = await (auth.serviceSupabase.from("intro_requests") as any)
      .update({ expires_at: rule.expiresAt })
      .eq("id", data.id);
    if (!expiryError) expiresAt = rule.expiresAt;
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "intro_request.created",
    entityType: "intro_request",
    entityId: data.id,
    metadata: { companyId: data.company_id, status: data.status },
  });

  if (data.company_id) {
    if (rule.masked) {
      // No actor and no name: the founder sees who only after upgrading.
      void notifyCompanyFounder(data.company_id, {
        type: "investor_intro_requested",
        title: "Intro request received",
        message: MASKED_INTRO_MESSAGE,
        entityType: "intro_request",
        entityId: data.id,
        deepLink: MASKED_INTRO_DEEP_LINK,
      });
    } else {
      void notifyFounderInvestorIntro({
        companyId: data.company_id,
        investorId: auth.profile.id,
        entityId: data.id,
      });
    }
  }

  await recordInvestorCrmActivity(auth.serviceSupabase, {
    investorId: auth.profile.id,
    companyId: data.company_id,
    campaignId: data.campaign_id,
    activityType: "requested_intro",
    metadata: { entityId: data.id, message: data.message },
  });

  emitOperationalEvent(auth.serviceSupabase, {
    eventType: "investor_intro_requested",
    eventCategory: "crm",
    entityType: "intro_request",
    entityId: data.id,
    actorUserId: auth.profile.id,
    actorRole: auth.profile.role,
    companyId: data.company_id,
    investorId: auth.profile.id,
    title: "Investor requested introduction",
    sourceModule: "investor_intro_requests",
    visibility: "internal",
    dedupeKey: `intro_request:${data.id}`,
    metadata: { status: data.status },
  });

  // A message thread would show the founder who the investor is, so it opens
  // only for founders whose plan reveals investors.
  if (data.company_id && !rule.masked) {
    void openMessageThreadFromSignal(auth.serviceSupabase, {
      companyId: data.company_id,
      investorId: auth.profile.id,
      createdBy: auth.profile.id,
      introRequestId: data.id,
      messageType: "intro_request",
      body: data.message?.trim() || "Investor requested an introduction.",
    });
  }

  emitActivity({
    classKey: "intro_requested",
    actorUserId: auth.profile.id,
    actorRole: auth.profile.role,
    companyId: data.company_id,
    investorId: auth.profile.id,
    entityType: "intro_request",
    entityId: data.id,
    sourceModule: "investor-intro-requests",
    title: "Investor requested an introduction",
    metadata: { status: data.status },
    dedupeKey: `activity-intro:${data.id}`,
  });

  return NextResponse.json({ introRequest: { ...data, expires_at: expiresAt } });
}
