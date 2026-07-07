import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { loadMatrix } from "@/lib/departments/admin";

export const dynamic = "force-dynamic";

// GET /api/admin/departments/matrix — departments, features, and current grants.
export async function GET(): Promise<Response> {
  try {
    await requireRole(["admin"]);
    return NextResponse.json(await loadMatrix());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
