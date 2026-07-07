import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { loadUserAccess } from "@/lib/departments/access";

export const dynamic = "force-dynamic";

// GET /api/admin/departments/me — the caller's effective department access (for nav filtering).
export async function GET(): Promise<Response> {
  try {
    const profile = await requireRole(["admin", "analyst"]);
    const access = await loadUserAccess(profile.id);
    return NextResponse.json({ isAdmin: access.isAdmin, unrestricted: access.unrestricted, paths: access.paths, hubs: access.hubs });
  } catch {
    // Not an internal user (founder/investor) or unauthenticated → no department context.
    return NextResponse.json({ isAdmin: false, unrestricted: true, paths: [], hubs: [] });
  }
}
