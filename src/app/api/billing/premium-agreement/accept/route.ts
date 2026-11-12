import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { normalizeUserRole } from "@/lib/api/admin";
import { billingOwnerOnlyResponse } from "@/lib/billing/billing-access";
import { parseAgreementInput } from "@/lib/billing/premium-agreement-core";
import { recordAcceptance } from "@/lib/billing/premium-agreement";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST: the founder checked the box. Records the acceptance (who, which company,
 * which agreement version, when), then emails them a copy. The time is the
 * server's, never the browser's. Needs `agree: true` in the body.
 */
export async function POST(req: Request): Promise<Response> {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (normalizeUserRole(profile.role) !== "founder") return NextResponse.json({ error: "Only founders can accept the Premium agreement." }, { status: 403 });
  const blocked = await billingOwnerOnlyResponse(profile.id);
  if (blocked) return blocked;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || body.agree !== true) return NextResponse.json({ error: "Please check the box to accept the agreement." }, { status: 400 });
  const parsed = parseAgreementInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";
    const result = await recordAcceptance({ profile, input: parsed.value, userAgent: req.headers.get("user-agent"), baseUrl: origin });
    return NextResponse.json({ id: result.row.id, acceptedAt: result.row.accepted_at, emailed: result.emailed });
  } catch (err) {
    console.error("[billing/premium-agreement/accept]", err);
    return NextResponse.json({ error: "We could not record your acceptance. Please try again." }, { status: 500 });
  }
}
