import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/investor/watchlist/[id]
 *
 * Update investor-private fields on a saved_deal row.
 * Currently supports: { notes: string }
 *
 * Ownership check: only the investor who saved the deal may update it.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let profile;
  try {
    profile = await requireRole(["investor"]);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null) as { notes?: string } | null;

  if (!body || body.notes === undefined) {
    return NextResponse.json({ error: "Missing notes field" }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  // Verify ownership — only update if this row belongs to the requesting investor.
  const { data: existing } = await admin
    .from("saved_deals")
    .select("id, investor_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.investor_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Cast required: notes column added in migration 20260619004, types not yet regenerated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("saved_deals")
    .update({ notes: body.notes || null })
    .eq("id", id) as { error: { message: string } | null };

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}
