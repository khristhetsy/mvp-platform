import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFounderSocial } from "@/lib/social/founder-auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { getManualOutreach, saveManualOutreach, type ManualOutreach } from "@/lib/outreach/manual-outreach";
import { normalizeAttachments } from "@/lib/outreach/manual-attachments";
import { FOUNDER_SOCIAL_DISCLAIMER } from "@/lib/social/templates";
import { logFounderSocialEvent } from "@/lib/social/activity";
import { actingBlock } from "@/lib/admin/acting-central";

export const dynamic = "force-dynamic";

// Email uses the Manual outreach tool, so every cap (investor limit, email budget, plan and
// the email on/off switch) applies there when the founder starts it. This route only places
// the post text there as a DRAFT with no recipients, and never overwrites a campaign in use.
export async function POST(req: NextRequest): Promise<Response> {
  const actingBlocked = await actingBlock();
  if (actingBlocked) return actingBlocked;
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const parsed = z.object({ subject: z.string().min(1).max(200), body: z.string().min(1).max(6000) }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Write the post first." }, { status: 400 });

  const { company } = await getActiveCompanyForUser(auth.profile as never);
  if (!company) return NextResponse.json({ error: "No company found." }, { status: 404 });

  const existing = (await getManualOutreach(company.id).catch(() => null)) as unknown as Partial<ManualOutreach> | null;
  const inUse = existing && (existing.status !== "draft" || (existing.emailSubject ?? "").trim() !== "" || (existing.emailBody ?? "").trim() !== "");
  if (inUse) {
    return NextResponse.json({ error: "You already have a Manual outreach email in progress. Open Manual outreach and paste this text there so nothing is overwritten.", code: "exists" }, { status: 409 });
  }

  const payload: ManualOutreach = {
    status: "draft",
    emailSubject: parsed.data.subject,
    emailBody: `${parsed.data.body}\n\n${FOUNDER_SOCIAL_DISCLAIMER}`,
    sequence: [],
    recipientIds: [],
    stopOnReply: true,
    attachments: normalizeAttachments(null),
  };
  const ok = await saveManualOutreach(company.id, auth.founderId, payload);
  if (!ok) return NextResponse.json({ error: "Could not save the email draft." }, { status: 500 });

  await logFounderSocialEvent({ type: "founder.social_email_draft_created", founderId: auth.founderId, description: parsed.data.subject.slice(0, 80) });
  return NextResponse.json({ ok: true, url: "/founder/deploy" });
}
