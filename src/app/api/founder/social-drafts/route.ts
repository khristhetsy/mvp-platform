import { NextResponse } from "next/server";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import { previewSocialOutreachDraft } from "@/lib/founder-crm/load-social-draft-context";
import { evaluateSocialOutreachReadiness } from "@/lib/founder-crm/social-outreach-readiness";
import {
  createSocialOutreachDraft,
  listSocialOutreachDrafts,
} from "@/lib/founder-crm/social-outreach-drafts";
import {
  detectRiskyPhrases,
  resolveSocialDraftComplianceStatus,
  SOCIAL_COMPLIANCE_WARNINGS,
} from "@/lib/founder-crm/social-draft-compliance";
import {
  notifyFounderSocialDraftFlagged,
  notifyFounderSocialDraftGenerated,
} from "@/lib/notifications/founder-outreach-events";
import {
  socialOutreachDraftCreateSchema,
  socialOutreachDraftGenerateSchema,
} from "@/lib/validation";

export async function GET() {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) {
    return auth.error;
  }

  const result = await listSocialOutreachDrafts(auth.supabase, auth.profile.id, auth.company.id);
  if (result.error) {
    return NextResponse.json({ error: "Unable to load social drafts." }, { status: 400 });
  }

  const socialReadiness = await evaluateSocialOutreachReadiness(auth.company);

  return NextResponse.json({
    drafts: result.data,
    complianceWarnings: SOCIAL_COMPLIANCE_WARNINGS,
    socialReadiness,
  });
}

export async function POST(request: Request) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) {
    return auth.error;
  }

  const socialReadiness = await evaluateSocialOutreachReadiness(auth.company);
  if (!socialReadiness.allowed) {
    return NextResponse.json(
      { error: "Complete social outreach readiness requirements first.", socialReadiness },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const generateParsed = socialOutreachDraftGenerateSchema.safeParse(body);

  if (generateParsed.success) {
    const generated = await previewSocialOutreachDraft({
      company: auth.company,
      founderId: auth.profile.id,
      draftType: generateParsed.data.draftType,
      platform: generateParsed.data.platform,
      campaignId: generateParsed.data.campaignId,
    });

    const complianceStatus = resolveSocialDraftComplianceStatus(generated.body);
    const riskyPhrases = detectRiskyPhrases(generated.body);

    if (!generateParsed.data.save) {
      return NextResponse.json({
        preview: generated,
        complianceStatus,
        riskyPhrases,
        complianceWarnings: SOCIAL_COMPLIANCE_WARNINGS,
      });
    }

    const saved = await createSocialOutreachDraft(auth.supabase, {
      founderId: auth.profile.id,
      companyId: auth.company.id,
      campaignId: generateParsed.data.campaignId,
      draftType: generateParsed.data.draftType,
      platform: generateParsed.data.platform,
      title: generated.title,
      body: generated.body,
      complianceStatus,
    });

    if (saved.error || !saved.data) {
      return NextResponse.json({ error: "Unable to save social draft." }, { status: 400 });
    }

    void notifyFounderSocialDraftGenerated({
      founderId: auth.profile.id,
      draftId: saved.data.id,
      draftType: saved.data.draft_type,
    });
    if (complianceStatus === "flagged") {
      void notifyFounderSocialDraftFlagged({ founderId: auth.profile.id, draftId: saved.data.id });
    }

    return NextResponse.json({
      draft: saved.data,
      riskyPhrases,
      complianceWarnings: SOCIAL_COMPLIANCE_WARNINGS,
    });
  }

  const createParsed = socialOutreachDraftCreateSchema.safeParse(body);
  if (!createParsed.success) {
    return NextResponse.json({ error: "Invalid social draft payload." }, { status: 400 });
  }

  const complianceStatus = resolveSocialDraftComplianceStatus(createParsed.data.body);
  const saved = await createSocialOutreachDraft(auth.supabase, {
    founderId: auth.profile.id,
    companyId: auth.company.id,
    campaignId: createParsed.data.campaignId,
    draftType: createParsed.data.draftType,
    platform: createParsed.data.platform,
    title: createParsed.data.title,
    body: createParsed.data.body,
    complianceStatus,
  });

  if (saved.error || !saved.data) {
    return NextResponse.json({ error: "Unable to save social draft." }, { status: 400 });
  }

  void notifyFounderSocialDraftGenerated({
    founderId: auth.profile.id,
    draftId: saved.data.id,
    draftType: saved.data.draft_type,
  });
  if (complianceStatus === "flagged") {
    void notifyFounderSocialDraftFlagged({ founderId: auth.profile.id, draftId: saved.data.id });
  }

  return NextResponse.json({ draft: saved.data });
}
