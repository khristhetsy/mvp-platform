import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { createAdminCheckoutUrl, describeMove, type AdminCheckoutInput } from "@/lib/billing/admin-checkout";
import { stripeConfigured } from "@/lib/stripe";
import { sendEmail } from "@/lib/email/send-email";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";
import { renderEmail } from "@/lib/email/layout";
import { makeMoveLinkToken, moveLinkPath } from "@/lib/billing/move-link-core";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const schema = z.object({
  plan: z.enum(["founder_basic", "founder_professional", "founder_premium"]),
  send: z.boolean().optional(),
});

function variantFor(plan: string): string | undefined {
  if (plan === "founder_basic") return process.env.LEMONSQUEEZY_VARIANT_ID_BASIC;
  if (plan === "founder_professional") return process.env.LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL;
  if (plan === "founder_premium") return process.env.LEMONSQUEEZY_VARIANT_ID_PREMIUM;
  return undefined;
}

// POST /api/admin/billing/customers/[id]/checkout — generate a card checkout link
// (Stripe, or Lemon Squeezy until Stripe is configured) for this customer. The customer enters their own card.
// Optionally email it to them. Never charges a card from the app.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireRole(["admin"]);
    const { id: profileId } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const variantId = variantFor(parsed.data.plan);
    if (!stripeConfigured() && !variantId) return NextResponse.json({ error: `No Lemon Squeezy variant configured for ${parsed.data.plan}.` }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = serviceRoleClientUntyped() as any;
    const { data: profile } = await db.from("profiles").select("email, full_name").eq("id", profileId).maybeSingle();
    const email: string | null = profile?.email ?? null;
    if (!email) return NextResponse.json({ error: "Customer has no email on file." }, { status: 400 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";
    const { data: subRaw } = await db
      .from("subscriptions")
      .select("plan_type, subscription_status, ls_subscription_id, ls_variant_id, stripe_subscription_id, stripe_customer_id, cancel_at_period_end, grace_period_ends_at, current_period_end")
      .eq("profile_id", profileId)
      .maybeSingle();
    const subscription = (subRaw ?? null) as AdminCheckoutInput["subscription"];
    const move = describeMove(subscription, parsed.data.plan);
    const url = await createAdminCheckoutUrl({ plan: parsed.data.plan, variantId, email, profileId, successUrl: `${appUrl}/admin/billing`, subscription });

    let emailed = false;
    if (parsed.data.send) {
      const planName = PLAN_LABELS[parsed.data.plan] ?? parsed.data.plan;
      const first = profile?.full_name ? String(profile.full_name).split(" ")[0] : null;
      const mail = renderEmail({
        audience: "founder",
        subject: move.moving ? `Move your iCapOS ${planName} billing to Stripe` : `Complete your iCapOS ${planName} subscription`,
        preheader: move.moving ? "Your price stays the same. Nothing is charged today." : `Your secure checkout link for ${planName} is ready.`,
        context: "Billing",
        eyebrow: "Billing",
        headline: move.moving ? `Keep your ${planName} plan` : `Activate your ${planName} plan`,
        intro: move.moving
          ? `${first ? `Hi ${first}, o` : "O"}ur card payments are moving from Lemon Squeezy to Stripe. Add your card once with the secure link below and your ${planName} plan continues at the same price. Nothing is charged today${move.firstChargeDate ? `: your first Stripe payment is on ${new Date(move.firstChargeDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}, your usual renewal date` : ""}. Your Lemon Squeezy subscription is cancelled automatically.`
          : `${first ? `Hi ${first}, h` : "H"}ere is your secure checkout link to activate ${planName}.`,
        blocks: [{ type: "facts", rows: [{ label: "Plan", value: planName }, { label: "Includes", value: "Every tool on iCapOS" }] }],
        // A Stripe checkout link expires after a day, so a move email links to a page that makes a fresh one on click.
        primary: { label: move.moving ? "Add my card" : "Complete checkout", url: move.moving ? `${appUrl}${moveLinkPath(makeMoveLinkToken(profileId))}` : url },
        footer: { reason: "You get this because an iCFO admin started checkout for your account." },
      });
      const ok = await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text, fromName: "iCapOS" });
      emailed = ok;
    }

    return NextResponse.json({ url, emailed });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checkout link failed." }, { status: 500 });
  }
}
