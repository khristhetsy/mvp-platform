import { NextResponse } from "next/server";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import {
  detectRiskyPhrases,
  SOCIAL_COMPLIANCE_WARNINGS,
} from "@/lib/founder-crm/social-draft-compliance";
import {
  archiveSocialOutreachDraft,
  updateSocialOutreachDraft,
} from "@/lib/founder-crm/social-outreach-drafts";
import {
  notifyFounderSocialDraftCopied,
  notifyFounderSocialDraftFlagged,
} from "@/lib/notifications/founder-outreach-events";
import { socialOutreachDraftUpdateSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = socialOutreachDraftUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid draft update." }, { status: 400 });
  }

  const patch: Parameters<typeof updateSocialOutreachDraft>[1]["patch"] = {};

  if (parsed.data.title !== undefined) {
    patch.title = parsed.data.title;
  }
  if (parsed.data.body !== undefined) {
    patch.body = parsed.data.body;
  }

  if (parsed.data.action === "review") {
    patch.status = "reviewed";
    if (parsed.data.body !== undefined && detectRiskyPhrases(parsed.data.body).length === 0) {
      patch.compliance_status = "approved";
    }
  } else if (parsed.data.action === "copy") {
    const copyBody = parsed.data.body;
    if (copyBody !== undefined && detectRiskyPhrases(copyBody).length > 0) {
      return NextResponse.json(
        {
          error: "Resolve flagged compliance phrases before copying.",
          riskyPhrases: detectRiskyPhrases(copyBody),
          complianceWarnings: SOCIAL_COMPLIANCE_WARNINGS,
          copyBlocked: true,
        },
        { status: 400 },
      );
    }
    patch.status = "copied";
    patch.copied_at = new Date().toISOString();
  } else if (parsed.data.action === "archive") {
    patch.status = "archived";
  } else if (parsed.data.action === "approve_compliance") {
    patch.compliance_status = "approved";
  }

  const result = await updateSocialOutreachDraft(auth.supabase, {
    draftId: id,
    founderId: auth.profile.id,
    patch,
  });

  if (result.error || !result.data) {
    return NextResponse.json({ error: "Unable to update draft." }, { status: 400 });
  }

  const riskyPhrases = detectRiskyPhrases(result.data.body);

  if (parsed.data.action === "copy" && riskyPhrases.length > 0) {
    return NextResponse.json(
      {
        error: "Resolve flagged compliance phrases before copying.",
        draft: result.data,
        riskyPhrases,
        complianceWarnings: SOCIAL_COMPLIANCE_WARNINGS,
        copyBlocked: true,
      },
      { status: 400 },
    );
  }

  if (parsed.data.action === "copy") {
    void notifyFounderSocialDraftCopied({ founderId: auth.profile.id, draftId: id });
  }
  if (result.data.compliance_status === "flagged") {
    void notifyFounderSocialDraftFlagged({ founderId: auth.profile.id, draftId: id });
  }

  return NextResponse.json({
    draft: result.data,
    riskyPhrases,
    complianceWarnings: SOCIAL_COMPLIANCE_WARNINGS,
    copyBlocked: parsed.data.action === "copy" && riskyPhrases.length > 0,
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const result = await archiveSocialOutreachDraft(auth.supabase, auth.profile.id, id);

  if (result.error) {
    return NextResponse.json({ error: "Unable to archive draft." }, { status: 400 });
  }

  return NextResponse.json({ draft: result.data });
}
