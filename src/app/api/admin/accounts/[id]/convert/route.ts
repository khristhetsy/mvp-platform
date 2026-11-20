import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getOrganization } from "@/lib/organizations/organizations";
import { isConvertPlan, variantIdForPlan, type ConvertPlan } from "@/lib/organizations/convert-to-paid";
import { createAdminCheckoutUrl } from "@/lib/billing/admin-checkout";
import { stripeConfigured } from "@/lib/stripe";
import { sendEmail } from "@/lib/email/send-email";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";
import { renderEmail } from "@/lib/email/layout";
import { agreementLinkPath, makeAgreementLinkToken } from "@/lib/billing/agreement-link-core";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function loose(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

const schema = z.object({
  plan: z.string().optional(),
  billToName: z.string().trim().max(200).optional(),
  billToEmail: z.string().trim().max(320).optional(),
  company: z.string().trim().max(200).optional(),
  // true: email the link to the bill to address. false: only return it (Copy link).
  send: z.boolean().optional(),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST — convert an admin-created demo Founder account to a paying one by card. Makes a
// card checkout link (Stripe, or Lemon Squeezy until Stripe is configured) for the demo's founder profile, using the client's own
// bill to email (the demo login uses a placeholder address), and optionally emails it.
// The account stays a comped demo until the first payment: the billing webhook then
// activates it (activateConvertedOrg). Calling it again for a pending account reuses the
// saved plan and email, which is how Copy link and Resend work.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Billing, so admin only, the same as the admin checkout link route.
  const auth = await requireApiProfile(["admin"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.data;

  const admin = createServiceRoleClient();
  const org = await getOrganization(admin, id);
  if (!org) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (org.type !== "founder" || org.created_via !== "admin_direct" || org.purpose !== "demo") {
    return NextResponse.json({ error: "Only an admin-created Founder demo can be converted here." }, { status: 400 });
  }

  // The founder behind the demo, made by Set up founder.
  const { data: company } = await loose(admin)
    .from("companies")
    .select("id, founder_id")
    .eq("org_id", org.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const founder = company as { id: string; founder_id: string | null } | null;
  if (!founder?.founder_id) {
    return NextResponse.json({ error: "This account has no founder yet. Use Set up founder first." }, { status: 400 });
  }

  // What was sent before, for Copy link and Resend.
  const { data: savedRow, error: savedError } = await loose(admin)
    .from("organizations")
    .select("conversion_plan, conversion_name, conversion_email")
    .eq("id", org.id)
    .maybeSingle();
  if (savedError) {
    return NextResponse.json({ error: "Conversion is not set up yet. Apply the conversion migration first." }, { status: 503 });
  }
  const saved = savedRow as { conversion_plan: string | null; conversion_name: string | null; conversion_email: string | null } | null;

  const planInput = body.plan ?? saved?.conversion_plan ?? null;
  if (!isConvertPlan(planInput)) {
    return NextResponse.json({ error: "Choose Basic, Professional or Premium." }, { status: 400 });
  }
  const plan: ConvertPlan = planInput;
  const email = (body.billToEmail ?? saved?.conversion_email ?? "").trim();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter the client's email address." }, { status: 400 });
  }
  const name = (body.billToName ?? saved?.conversion_name ?? "").trim() || null;

  const variantId = variantIdForPlan(plan);
  if (plan === "founder_premium" && !stripeConfigured()) {
    return NextResponse.json({ error: "Premium is paid through Stripe, which is not configured." }, { status: 400 });
  }
  if (!stripeConfigured() && !variantId) {
    return NextResponse.json({ error: `No Lemon Squeezy variant is configured for ${PLAN_LABELS[plan]}.` }, { status: 400 });
  }

  let url: string;
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";
    // Premium: the client accepts the Services Agreement first, then goes on to Stripe from that page.
    url = plan === "founder_premium"
      ? `${appUrl}${agreementLinkPath(makeAgreementLinkToken(org.id))}`
      : await createAdminCheckoutUrl({ plan, variantId, email, profileId: founder.founder_id, successUrl: `${appUrl}/admin/accounts`, name: name ?? undefined });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create the checkout link." }, { status: 502 });
  }

  const sentAt = new Date().toISOString();
  const { error: saveError } = await loose(admin)
    .from("organizations")
    .update({ conversion_plan: plan, conversion_name: name, conversion_email: email, conversion_sent_at: sentAt })
    .eq("id", org.id);
  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });

  // The legal company name the client gave, on the demo's company.
  if (body.company) {
    await loose(admin).from("companies").update({ company_name: body.company }).eq("id", founder.id);
  }

  let emailed = false;
  if (body.send !== false) {
    const planName = PLAN_LABELS[plan];
    const first = name ? name.split(" ")[0] : null;
    const mail = renderEmail({
      audience: "founder",
      subject: `Complete your iCapOS ${planName} subscription`,
      preheader: `Your secure checkout link for ${planName} is ready.`,
      context: "Billing",
      eyebrow: "Billing",
      headline: `Activate your ${planName} plan`,
      intro: plan === "founder_premium"
        ? `${first ? `Hi ${first}, h` : "H"}ere is your link to accept the iCFO Services Agreement and activate ${planName}. You review and accept the agreement first, then pay by card.`
        : `${first ? `Hi ${first}, h` : "H"}ere is your secure checkout link to activate ${planName}.`,
      blocks: [{ type: "facts", rows: [{ label: "Plan", value: planName }, { label: "Includes", value: "Every tool on iCapOS" }] }],
      primary: { label: plan === "founder_premium" ? "Review agreement and pay" : "Complete checkout", url },
      footer: { reason: "You get this because an iCFO admin started checkout for your account." },
    });
    emailed = await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text, fromName: "iCapOS" });
  }

  return NextResponse.json({ url, emailed, conversion: { plan, name, email, sentAt } });
}
