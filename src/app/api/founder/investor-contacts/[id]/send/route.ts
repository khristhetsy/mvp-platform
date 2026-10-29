import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { emailDispatchAllowedForUser, EMAIL_DISABLED_MESSAGE } from "@/lib/organizations/organizations";
import { getDistributionPlan } from "@/lib/subscriptions/get-subscription";
import { founderEntitlements } from "@/lib/subscriptions/entitlements";
import { capMessage, checkManualOutreachCap } from "@/lib/outreach/investor-cap";
import { checkManualEmailCap } from "@/lib/outreach/email-cap";
import { enrollOneManualRecipient, stopOneManualRecipient } from "@/lib/outreach/manual-outreach";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Send only: email ONE of the founder's contacts with their saved Manual outreach
 * email (first step only, no follow ups). Same gates as starting Manual outreach:
 * plan, investor cap, email cap, and the account's email switch.
 */
export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const { company, org } = await getActiveCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "No company found." }, { status: 404 });

  const plan = await getDistributionPlan(auth.profile.id);
  if (!founderEntitlements(plan).canDistribute) {
    return NextResponse.json(
      { error: "Sending outreach unlocks on Basic. Upgrade to email investors.", code: "upgrade_required" },
      { status: 403 },
    );
  }

  const cap = await checkManualOutreachCap({ founderId: auth.profile.id, companyId: company.id, plan, selectedIds: [id] });
  if (!cap.ok) {
    return NextResponse.json(
      { error: capMessage(cap), code: "investor_cap_reached", cap: cap.cap, used: cap.used, remaining: cap.remaining, resets_at: cap.resetsAt.toISOString() },
      { status: 403 },
    );
  }
  const emailCap = await checkManualEmailCap({ founderId: auth.profile.id, companyId: company.id, selectedIds: [id] });
  if (!emailCap.ok) {
    return NextResponse.json(
      { error: emailCap.message, code: "email_cap_reached", cap: emailCap.cap, used: emailCap.used, remaining: emailCap.remaining, resets_at: emailCap.resetsAt },
      { status: 403 },
    );
  }

  const emailBlocked = org
    ? !org.email_dispatch_enabled
    : !(await emailDispatchAllowedForUser(createServiceRoleClient(), auth.profile.id));
  if (emailBlocked) {
    return NextResponse.json({ error: EMAIL_DISABLED_MESSAGE, code: "email_disabled" }, { status: 403 });
  }

  const result = await enrollOneManualRecipient(company.id, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ status: "queued", already: result.already });
}

/** Cancel the send while it is still queued. */
export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const { company } = await getActiveCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "No company found." }, { status: 404 });

  await stopOneManualRecipient(company.id, id);
  return NextResponse.json({ status: "stopped" });
}
