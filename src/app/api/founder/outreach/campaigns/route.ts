import { NextResponse } from "next/server";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import {
  addOutreachMessage,
  createOutreachCampaign,
  listOutreachCampaigns,
  resolveCampaignContactIdsFromTargets,
} from "@/lib/founder-crm/outreach";
import { generateOutreachDraft } from "@/lib/founder-crm/outreach-drafts";
import { evaluateFounderOutreachReadiness } from "@/lib/founder-crm/outreach-readiness";
import { recordComplianceEvent } from "@/lib/compliance/events";
import {
  notifyFounderCampaignDrafted,
  notifyFounderOutreachBlocked,
} from "@/lib/notifications/founder-outreach-events";
import { outreachCampaignSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) {
    return auth.error;
  }

  const result = await listOutreachCampaigns(auth.supabase, auth.profile.id, auth.company.id);
  if (result.error) {
    return NextResponse.json({ error: "Unable to load campaigns." }, { status: 400 });
  }

  return NextResponse.json({ campaigns: result.data });
}

export async function POST(request: Request) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = outreachCampaignSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid campaign data." }, { status: 400 });
  }

  const readiness = await evaluateFounderOutreachReadiness(auth.company, auth.profile.id);

  if (!readiness.allowed) {
    void recordComplianceEvent({
      companyId: auth.company.id,
      founderId: auth.profile.id,
      eventType: "outreach_without_readiness",
      severity: "high",
      source: "outreach_campaigns",
      title: "Outreach attempted without readiness",
      description: "Founder attempted to create an outreach campaign before meeting readiness requirements.",
      sourceId: auth.profile.id,
    });
  }

  const campaignResult = await createOutreachCampaign(auth.supabase, {
    founderId: auth.profile.id,
    companyId: auth.company.id,
    name: parsed.data.name,
    dailyLimit: parsed.data.dailyLimit,
  });

  if (campaignResult.error) {
    const message = campaignResult.error.message ?? "Unable to create campaign.";
    if (!readiness.allowed) {
      void notifyFounderOutreachBlocked({ founderId: auth.profile.id, reason: message });
    }
    return NextResponse.json({ error: message, readiness }, { status: 400 });
  }

  let contactIds = [...(parsed.data.contactIds ?? [])];

  if (parsed.data.targetIds?.length) {
    const fromTargets = await resolveCampaignContactIdsFromTargets(
      auth.supabase,
      auth.profile.id,
      auth.company.id,
      parsed.data.targetIds,
    );
    if (fromTargets.error) {
      return NextResponse.json({ error: "Unable to resolve pipeline targets." }, { status: 400 });
    }
    contactIds = [...new Set([...contactIds, ...(fromTargets.data ?? [])])];
  }

  if (contactIds.length > 25) {
    return NextResponse.json({ error: "Campaign audience cannot exceed 25 contacts." }, { status: 400 });
  }

  const draftKind = parsed.data.draftKind ?? "intro";
  const messages = [];

  for (const contactId of contactIds) {
    const { data: contact } = await auth.supabase
      .from("founder_investor_contacts")
      .select("*")
      .eq("id", contactId)
      .eq("founder_id", auth.profile.id)
      .maybeSingle();

    if (!contact) {
      continue;
    }

    const draft = generateOutreachDraft({
      kind: draftKind,
      company: auth.company,
      contact,
      readinessScore: readiness.readinessScore,
      founderName: auth.profile.full_name,
    });

    const msgResult = await addOutreachMessage(auth.supabase, {
      campaignId: campaignResult.data!.id,
      contactId,
      subject: draft.subject,
      body: draft.body,
    });

    if (msgResult.data) {
      messages.push(msgResult.data);
    }
  }

  void notifyFounderCampaignDrafted({
    founderId: auth.profile.id,
    campaignId: campaignResult.data!.id,
    campaignName: campaignResult.data!.name,
  });

  return NextResponse.json({
    campaign: campaignResult.data,
    messages,
    readiness,
    complianceNotice:
      "Messages are queued internally only. No emails are sent in this phase. Review all drafts before queueing.",
  });
}
