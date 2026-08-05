import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getSalesScope } from "@/lib/sales/scope";
import { listAssignableStaff } from "@/lib/sales/settings";

export const dynamic = "force-dynamic";

// GET /api/sales/view-scope — whether this user may use the Sales Hub View
// toggle (Me / Team / Someone else). Gated on the manage_crm permission, so
// Member Sales reps get canViewTeam=false and no member list.
export async function GET() {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ canViewTeam: false, members: [] });

  const scope = await getSalesScope(profile);
  const members = scope.canViewTeam ? await listAssignableStaff() : [];
  return NextResponse.json({ canViewTeam: scope.canViewTeam, members });
}
