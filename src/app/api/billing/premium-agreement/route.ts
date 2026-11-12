import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { normalizeUserRole } from "@/lib/api/admin";
import { billingOwnerOnlyResponse } from "@/lib/billing/billing-access";
import { parseAgreementInput } from "@/lib/billing/premium-agreement-core";
import {
  agreementDefaultsFor,
  findAcceptanceById,
  findCurrentAcceptance,
  inputFromRow,
  renderAgreementPdf,
} from "@/lib/billing/premium-agreement";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function pdfResponse(pdf: Buffer, disposition: "inline" | "attachment"): Response {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="iCFO-Services-Agreement.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * GET: the checkout dialog's starting values and whether the current agreement
 * is already accepted. With ?acceptance=<id>: the accepted copy as a PDF,
 * rendered again from the stored values (founder: own rows only; staff: any).
 */
export async function GET(req: Request): Promise<Response> {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const role = normalizeUserRole(profile.role);
  const id = new URL(req.url).searchParams.get("acceptance");

  try {
    if (id) {
      const row = await findAcceptanceById(id);
      const staff = role === "admin" || role === "analyst";
      if (!row || (row.profile_id !== profile.id && !staff)) return NextResponse.json({ error: "Not found." }, { status: 404 });
      return pdfResponse(await renderAgreementPdf(inputFromRow(row), row.accepted_at), "attachment");
    }

    if (role !== "founder") return NextResponse.json({ error: "Founders only." }, { status: 403 });
    const blocked = await billingOwnerOnlyResponse(profile.id);
    if (blocked) return blocked;
    const [defaults, accepted] = await Promise.all([agreementDefaultsFor(profile), findCurrentAcceptance(profile.id)]);
    return NextResponse.json({ defaults, accepted: accepted ? { id: accepted.id, acceptedAt: accepted.accepted_at } : null });
  } catch (err) {
    console.error("[billing/premium-agreement GET]", err);
    return NextResponse.json({ error: "We could not load the agreement. Please try again." }, { status: 500 });
  }
}

/** POST: the agreement filled with the founder's details, as a PDF, so they can read it before accepting. Nothing is recorded. */
export async function POST(req: Request): Promise<Response> {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (normalizeUserRole(profile.role) !== "founder") return NextResponse.json({ error: "Founders only." }, { status: 403 });
  const blocked = await billingOwnerOnlyResponse(profile.id);
  if (blocked) return blocked;

  const parsed = parseAgreementInput(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    return pdfResponse(await renderAgreementPdf(parsed.value, new Date()), "inline");
  } catch (err) {
    console.error("[billing/premium-agreement POST]", err);
    return NextResponse.json({ error: "We could not prepare the agreement. Please try again." }, { status: 500 });
  }
}
