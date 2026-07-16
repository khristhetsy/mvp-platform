import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { computeVariance } from "@/lib/forecast/store";
import { getSalesScope } from "@/lib/sales/scope";
import { forecastOwnerId } from "@/lib/sales/forecast-scope";

export const dynamic = "force-dynamic";

// GET /api/sales/forecast/variance?scenario=<id> — latest snapshot vs actuals per elapsed month.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const scenario = req.nextUrl.searchParams.get("scenario");
  if (!scenario) return NextResponse.json({ error: "scenario is required." }, { status: 400 });
  const scope = await getSalesScope(profile);
  const result = await computeVariance(scenario, forecastOwnerId(scope, profile.id, req.nextUrl.searchParams.get("scope")));
  return NextResponse.json(result);
}
