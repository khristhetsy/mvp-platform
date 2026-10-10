import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { normalizeUserRole } from "@/lib/api/admin";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { createWireInvoice, getWireInstructions, listWireInvoicesForProfile } from "@/lib/billing/wire";
import { recordFunnelEvent } from "@/lib/analytics/funnel";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET: the signed in founder's wire invoices and the wire instructions. */
export async function GET(): Promise<Response> {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (normalizeUserRole(profile.role) !== "founder") return NextResponse.json({ error: "Founders only." }, { status: 403 });
  const [invoices, instructions] = await Promise.all([listWireInvoicesForProfile(profile.id), getWireInstructions()]);
  return NextResponse.json({ invoices, instructions });
}

const bodySchema = z.object({ cycle: z.enum(["monthly", "quarterly"]) });

/** POST: request a Premium wire invoice (founder only). Returns the invoice. */
export async function POST(req: Request): Promise<Response> {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (normalizeUserRole(profile.role) !== "founder") return NextResponse.json({ error: "Only founders can request a Premium invoice." }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Choose monthly or quarterly billing." }, { status: 400 });

  try {
    const { company } = await getActiveCompanyForUser(profile);
    const result = await createWireInvoice({ profileId: profile.id, companyId: company?.id ?? null, cycle: parsed.data.cycle });
    if (!result.reused) {
      await recordFunnelEvent({ sessionId: `checkout_${profile.id}`, eventName: "checkout_start", properties: { plan: "founder_premium", method: "wire", cycle: parsed.data.cycle } });
    }
    return NextResponse.json({ invoice: result.invoice, emailed: result.emailed, reused: result.reused, instructions: await getWireInstructions() });
  } catch (err) {
    console.error("[billing/wire-invoice]", err);
    return NextResponse.json({ error: "We could not create your invoice. Please try again, or contact us." }, { status: 500 });
  }
}
