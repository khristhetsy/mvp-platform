import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { isSuperAdmin } from "@/lib/rbac/effective-permissions";
import { listLeadAssignableStaff } from "@/lib/sales/settings";

export const dynamic = "force-dynamic";

// GET /api/sales/contacts/assignable-members — lead-assignable members for the mass
// Lead assign picker. Super admin only (matches who can mass-assign).
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  if (!isSuperAdmin(profile)) return NextResponse.json({ members: [] });
  return NextResponse.json({ members: await listLeadAssignableStaff() });
}
