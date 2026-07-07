import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { listAudit } from "@/lib/departments/admin";

export const dynamic = "force-dynamic";

// GET /api/admin/departments/audit?limit=&offset= — paginated audit feed.
export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireRole(["admin"]);
    const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 100) || 100));
    const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") ?? 0) || 0);
    return NextResponse.json({ rows: await listAudit(limit, offset) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
