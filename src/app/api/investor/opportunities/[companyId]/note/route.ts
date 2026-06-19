import { NextResponse } from "next/server";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/investor/opportunities/[companyId]/note
 * Returns the investor's private note for this company (from saved_deals).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  let investorId: string;
  try {
    const session = await requireInvestorWorkspaceSession();
    investorId = session.investorId;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId } = await params;
  const admin = createServiceRoleClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (admin as any)
    .from("saved_deals")
    .select("id, notes")
    .eq("investor_id", investorId)
    .eq("company_id", companyId)
    .maybeSingle();

  const { data } = result as {
    data: { id: string; notes: string | null } | null;
    error: unknown;
  };

  return NextResponse.json({ savedDealId: data?.id ?? null, note: data?.notes ?? null });
}

/**
 * PATCH /api/investor/opportunities/[companyId]/note
 * Upserts a saved_deal row for this company and updates the note.
 * Auto-saves the deal if the investor hasn't explicitly saved it yet.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  let investorId: string;
  try {
    const session = await requireInvestorWorkspaceSession();
    investorId = session.investorId;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId } = await params;

  let body: { note?: string };
  try {
    body = await request.json() as { note?: string };
  } catch {
    body = {};
  }

  const note = typeof body.note === "string" ? body.note.trim() || null : null;
  const admin = createServiceRoleClient();

  // Upsert: creates saved_deal if not exists, updates note either way
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upsertResult = await (admin as any)
    .from("saved_deals")
    .upsert(
      {
        investor_id: investorId,
        company_id: companyId,
        notes: note,
        status: "Saved",
      },
      { onConflict: "investor_id,company_id" },
    )
    .select("id")
    .single();

  const { data: upserted, error } = upsertResult as {
    data: { id: string } | null;
    error: unknown;
  };

  if (error || !upserted) {
    console.error("Opportunity note save error:", error);
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }

  return NextResponse.json({ saved: true, savedDealId: upserted.id });
}
