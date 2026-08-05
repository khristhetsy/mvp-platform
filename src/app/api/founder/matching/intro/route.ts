import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { isProspectInvestorId } from "@/lib/matching/prospect-investors";
import { writeAuditLog } from "@/lib/data/audit";

export const dynamic = "force-dynamic";

// POST /api/founder/matching/intro — the founder requests an introduction to an
// anonymized matched investor. `ref` is the opaque id from the match card.
//   - registered member → creates an intro_requests row (admin Intro Requests queue)
//   - CRM prospect      → logs a brokered-intro request for the iCapOS team
export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as { ref?: string } | null;
  const ref = body?.ref?.trim();
  if (!ref) return NextResponse.json({ error: "ref is required." }, { status: 400 });

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "No company found." }, { status: 400 });

  const admin = createServiceRoleClient();

  if (isProspectInvestorId(ref)) {
    // Prospect isn't a platform user — record a brokered-intro request for the team.
    await writeAuditLog(admin, {
      userId: auth.profile.id,
      action: "matching.prospect_intro_requested",
      entityType: "matching_intro",
      entityId: company.id,
      metadata: { companyId: company.id, investorRef: ref, kind: "prospect" },
    });
    return NextResponse.json({ ok: true, brokered: true });
  }

  // Member investor: create an intro request if one isn't already open.
  const { data: existing } = await admin
    .from("intro_requests")
    .select("id")
    .eq("company_id", company.id)
    .eq("investor_id", ref)
    .maybeSingle();

  if (!existing) {
    const { error } = await admin.from("intro_requests").insert({
      company_id: company.id,
      investor_id: ref,
      message: "Founder requested an introduction via the Matching Center.",
    } as never);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, brokered: false });
}
