import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { loadActualsSeries, loadActualsAnchor } from "@/lib/forecast/store";

export const dynamic = "force-dynamic";

// GET /api/sales/forecast/actuals — monthly MRR actuals series + latest anchor.
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const [series, anchor] = await Promise.all([loadActualsSeries(), loadActualsAnchor()]);
  return NextResponse.json({ series, anchor });
}
