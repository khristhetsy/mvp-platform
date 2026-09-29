import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { setProspectIntroStatus, type ProspectIntroStatus } from "@/lib/matching/prospect-intros";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { notifyFounderIntroOutcome } from "@/lib/matching/intro-outcome-notify";

export const dynamic = "force-dynamic";

const VALID: ProspectIntroStatus[] = ["new", "contacted", "dismissed"];

// POST /api/admin/prospect-intros/[id] — update a brokered intro's status. Staff only.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  const status = body?.status as ProspectIntroStatus | undefined;
  if (!status || !VALID.includes(status)) {
    return NextResponse.json({ error: "status must be new, contacted, or dismissed." }, { status: 400 });
  }

  const ok = await setProspectIntroStatus(id, status, auth.profile.id);
  if (!ok) return NextResponse.json({ error: "Could not update." }, { status: 500 });

  // Tell the founder: "contacted" means iCFO reached out, "dismissed" means no.
  if (status === "contacted" || status === "dismissed") {
    const admin = createServiceRoleClient();
    const { data } = await admin
      .from("prospect_intro_requests" as never)
      .select("founder_id, company_id, companies ( company_name )")
      .eq("id", id)
      .maybeSingle();
    const row = data as { founder_id?: string | null; companies?: { company_name?: string | null } | Array<{ company_name?: string | null }> | null } | null;
    const company = Array.isArray(row?.companies) ? row?.companies[0] : row?.companies;
    if (row?.founder_id) {
      await notifyFounderIntroOutcome({
        founderId: row.founder_id,
        companyName: company?.company_name ?? "your company",
        outcome: status === "contacted" ? "contacted" : "declined",
        investorLabel: "Investor",
        note: null,
        actorUserId: auth.profile.id,
        entityType: "prospect_intro_request",
        entityId: id,
      });
    }
  }
  return NextResponse.json({ ok: true });
}
