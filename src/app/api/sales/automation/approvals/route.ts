import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { listPendingApprovals } from "@/lib/sales/automation";

export const dynamic = "force-dynamic";

// GET /api/sales/automation/approvals?opportunityId=: open suggestions, newest first.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const opportunityId = req.nextUrl.searchParams.get("opportunityId") ?? undefined;
  return NextResponse.json({ approvals: await listPendingApprovals(opportunityId) });
}
