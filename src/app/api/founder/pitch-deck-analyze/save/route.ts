import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { savePitchDeckAnalysis } from "@/lib/pitch-deck/analysis-store";
import type { PitchDeckAnalysis } from "@/app/api/founder/pitch-deck-analyze/route";

export const dynamic = "force-dynamic";

// POST — persist the founder's current pitch-deck analysis.
export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { company } = await getActiveCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "No company linked." }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { analysis?: PitchDeckAnalysis } | null;
  if (!body?.analysis) return NextResponse.json({ error: "No analysis provided." }, { status: 400 });

  const savedAt = await savePitchDeckAnalysis(createServiceRoleClient(), company.id, body.analysis);
  return NextResponse.json({ savedAt });
}
