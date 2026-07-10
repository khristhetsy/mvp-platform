import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { computeVariance } from "@/lib/forecast/store";

export const dynamic = "force-dynamic";

// GET /api/sales/forecast/variance?scenario=<id> — latest snapshot vs actuals per elapsed month.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const scenario = req.nextUrl.searchParams.get("scenario");
  if (!scenario) return NextResponse.json({ error: "scenario is required." }, { status: 400 });
  const result = await computeVariance(scenario);
  return NextResponse.json(result);
}
