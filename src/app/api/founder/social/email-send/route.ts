import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFounderSocial } from "@/lib/social/founder-auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { emailDispatchAllowedForUser, EMAIL_DISABLED_MESSAGE } from "@/lib/organizations/organizations";
import { getUserPlan } from "@/lib/subscriptions/get-subscription";
import { founderEntitlements } from "@/lib/subscriptions/entitlements";
import { capMessage, checkManualOutreachCap } from "@/lib/outreach/investor-cap";
import { checkManualEmailCap } from "@/lib/outreach/email-cap";
import { normalizeAttachments } from "@/lib/outreach/manual-attachments";
import { enrollManualRecipients, getManualOutreach, processManualOutreach, saveManualOutreach, type ManualOutreach } from "@/lib/outreach/manual-outreach";
import { founderLimits } from "@/lib/investor-directory/db";
import { sendBudget } from "@/lib/investor-directory/allowance";
import { FOUNDER_SOCIAL_DISCLAIMER } from "@/lib/social/templates";
import { logFounderSocialEvent } from "@/lib/social/activity";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

/** The founder's investor contacts that have an email, and how many emails are left this period. */
export async function GET(): Promise<Response> {
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const { company } = await getActiveCompanyForUser(auth.profile as never);
  if (!company) return NextResponse.json({ contacts: [], remaining: null });
  const { data } = await db().from("founder_investor_contacts").select("id, investor_name, firm_name, email").eq("company_id", company.id).not("email", "is", null).order("investor_name").limit(500);
  const contacts = ((data ?? []) as Array<{ id: string; investor_name: string | null; firm_name: string | null; email: string | null }>)
    .filter((c) => c.email?.trim())
    .map((c) => ({ id: c.id, name: c.investor_name ?? c.email ?? "", firm: c.firm_name ?? null, email: c.email as string }));
  let remaining: number | null = null;
  let limit: number | null = null;
  try {
    const l = await founderLimits(auth.founderId);
    remaining = sendBudget(l.emails, l.emailsUsed);
    limit = l.emails;
  } catch { /* shown without a count */ }
  return NextResponse.json({ contacts, remaining, limit });
}

/**
 * Send now: the post text goes to the chosen investors as an email, through Manual outreach.
 * Every Manual outreach rule applies here exactly as it does there: plan, investor limit,
 * monthly email limit and the email on/off switch. It never overwrites a campaign in use.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const parsed = z.object({
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(6000),
    recipientIds: z.array(z.string().uuid()).min(1).max(500),
  }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Write the email and choose at least one investor." }, { status: 400 });
  const recipientIds = [...new Set(parsed.data.recipientIds)];

  const { company, org } = await getActiveCompanyForUser(auth.profile as never);
  if (!company) return NextResponse.json({ error: "No company found." }, { status: 404 });

  const plan = await getUserPlan(auth.founderId);
  if (!founderEntitlements(plan).canDistribute) {
    return NextResponse.json({ error: "Sending email unlocks on Basic. You can save a draft now and upgrade to reach investors.", code: "upgrade_required" }, { status: 403 });
  }
  const emailBlocked = org ? !org.email_dispatch_enabled : !(await emailDispatchAllowedForUser(createServiceRoleClient(), auth.founderId));
  if (emailBlocked) return NextResponse.json({ error: EMAIL_DISABLED_MESSAGE, code: "email_disabled" }, { status: 403 });

  const existing = (await getManualOutreach(company.id).catch(() => null)) as unknown as Partial<ManualOutreach> | null;
  const inUse = existing && (existing.status === "queued" || (existing.emailSubject ?? "").trim() !== "" || (existing.emailBody ?? "").trim() !== "");
  if (inUse) {
    return NextResponse.json({ error: "You already have a Manual outreach email in progress. Finish or clear it in Manual outreach first so nothing is overwritten.", code: "exists" }, { status: 409 });
  }

  const cap = await checkManualOutreachCap({ founderId: auth.founderId, companyId: company.id, plan, selectedIds: recipientIds });
  if (!cap.ok) {
    return NextResponse.json({ error: capMessage(cap), code: "investor_cap_reached", cap: cap.cap, used: cap.used, remaining: cap.remaining }, { status: 403 });
  }
  const emailCap = await checkManualEmailCap({ founderId: auth.founderId, companyId: company.id, selectedIds: recipientIds });
  if (!emailCap.ok) {
    return NextResponse.json({ error: emailCap.message, code: "email_cap_reached", cap: emailCap.cap, used: emailCap.used, remaining: emailCap.remaining }, { status: 403 });
  }

  const payload: ManualOutreach = {
    status: "queued",
    emailSubject: parsed.data.subject,
    emailBody: `${parsed.data.body}\n\n${FOUNDER_SOCIAL_DISCLAIMER}`,
    sequence: [{ label: "Post email", dayOffset: 0 }],
    recipientIds,
    stopOnReply: true,
    attachments: normalizeAttachments(null),
  };
  const ok = await saveManualOutreach(company.id, auth.founderId, payload);
  if (!ok) return NextResponse.json({ error: "Could not save the email." }, { status: 500 });
  try { await enrollManualRecipients(company.id, recipientIds); } catch { return NextResponse.json({ error: "Could not add the investors." }, { status: 500 }); }

  // Send the first step now for this company only; the email cap is re-applied inside the pass.
  let sent = 0;
  let live = true;
  try {
    const r = await processManualOutreach(company.id);
    sent = r.sent;
    live = r.liveSend;
  } catch { /* the regular send pass picks the rest up */ }

  await logFounderSocialEvent({ type: "founder.social_email_sent", founderId: auth.founderId, description: parsed.data.subject.slice(0, 80) });
  return NextResponse.json({ ok: true, queued: recipientIds.length, sent, live });
}
