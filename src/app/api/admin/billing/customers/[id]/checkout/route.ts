import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { createCheckoutUrl } from "@/lib/lemonsqueezy";
import { sendEmail } from "@/lib/email/send-email";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const schema = z.object({
  plan: z.enum(["founder_basic", "founder_professional"]),
  send: z.boolean().optional(),
});

function variantFor(plan: string): string | undefined {
  if (plan === "founder_basic") return process.env.LEMONSQUEEZY_VARIANT_ID_BASIC;
  if (plan === "founder_professional") return process.env.LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL;
  return undefined;
}

// POST /api/admin/billing/customers/[id]/checkout — generate a Lemon Squeezy
// checkout link for this customer (the customer enters their own card at LS).
// Optionally email it to them. Never charges a card from the app.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireRole(["admin"]);
    const { id: profileId } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const variantId = variantFor(parsed.data.plan);
    if (!variantId) return NextResponse.json({ error: `No Lemon Squeezy variant configured for ${parsed.data.plan}.` }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = serviceRoleClientUntyped() as any;
    const { data: profile } = await db.from("profiles").select("email, full_name").eq("id", profileId).maybeSingle();
    const email: string | null = profile?.email ?? null;
    if (!email) return NextResponse.json({ error: "Customer has no email on file." }, { status: 400 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";
    const url = await createCheckoutUrl({ variantId, email, profileId, successUrl: `${appUrl}/admin/billing` });

    let emailed = false;
    if (parsed.data.send) {
      const planName = PLAN_LABELS[parsed.data.plan] ?? parsed.data.plan;
      const ok = await sendEmail({
        to: email,
        subject: `Complete your iCapOS ${planName} subscription`,
        html: `<p>Hi ${profile?.full_name ? String(profile.full_name).split(" ")[0] : "there"},</p><p>Here's your secure checkout link to activate <strong>${planName}</strong>:</p><p><a href="${url}">Complete checkout →</a></p><p>iCapOS — Powered by iCFO Capital Global, Inc.</p>`,
        text: `Complete your iCapOS ${planName} subscription: ${url}`,
      });
      emailed = ok;
    }

    return NextResponse.json({ url, emailed });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checkout link failed." }, { status: 500 });
  }
}
