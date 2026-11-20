import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkFormRateLimit } from "@/lib/ai-site/ratelimit";
import { verifyAgreementLinkToken } from "@/lib/billing/agreement-link-core";
import { parseAgreementInput } from "@/lib/billing/premium-agreement-core";
import { findCurrentAcceptance, recordAcceptance } from "@/lib/billing/premium-agreement";
import { createAdminCheckoutUrl } from "@/lib/billing/admin-checkout";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function loose(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

/**
 * POST: the client opened the agreement link an admin sent for a Premium conversion. Records
 * their acceptance against the account's founder profile, then returns the Stripe checkout
 * link. The token names the organization, and only an organization with a pending Premium
 * conversion can be used, so the link cannot be pointed at anything else.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const limited = await checkFormRateLimit({ scope: "premium_agreement_link", ip, limit: 15 });
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const orgId = verifyAgreementLinkToken(typeof body?.token === "string" ? body.token : null);
  if (!body || !orgId) return NextResponse.json({ error: "This link is not valid. Please ask iCFO for a new one." }, { status: 401 });
  if (body.agree !== true) return NextResponse.json({ error: "Please check the box to accept the agreement." }, { status: 400 });
  const parsed = parseAgreementInput(body.agreement);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const admin = loose(createServiceRoleClient());
    const { data: orgRow } = await admin
      .from("organizations")
      .select("id, conversion_plan, conversion_email, conversion_name")
      .eq("id", orgId)
      .eq("created_via", "admin_direct")
      .maybeSingle();
    const org = orgRow as { id: string; conversion_plan: string | null; conversion_email: string | null; conversion_name: string | null } | null;
    if (!org || org.conversion_plan !== "founder_premium" || !org.conversion_email) {
      return NextResponse.json({ error: "This link is no longer active. Please ask iCFO for a new one." }, { status: 410 });
    }
    const { data: company } = await admin.from("companies").select("founder_id").eq("org_id", org.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
    const founderId = (company as { founder_id: string | null } | null)?.founder_id;
    if (!founderId) return NextResponse.json({ error: "This account is not ready yet. Please contact iCFO." }, { status: 409 });
    const { data: profileRow } = await admin.from("profiles").select("*").eq("id", founderId).maybeSingle();
    if (!profileRow) return NextResponse.json({ error: "This account is not ready yet. Please contact iCFO." }, { status: 409 });

    // The demo login holds a placeholder address, so the copy goes to the client's own email.
    const profile = { ...(profileRow as Profile), email: org.conversion_email, full_name: parsed.value.acceptedName };
    const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";
    if (!(await findCurrentAcceptance(founderId))) {
      await recordAcceptance({ profile, input: parsed.value, userAgent: req.headers.get("user-agent"), baseUrl: origin });
    }
    const url = await createAdminCheckoutUrl({
      plan: "founder_premium",
      email: org.conversion_email,
      profileId: founderId,
      successUrl: `${origin}/agreement/premium/done`,
      name: org.conversion_name ?? undefined,
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[billing/premium-agreement/link]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
