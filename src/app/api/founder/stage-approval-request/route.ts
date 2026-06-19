import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { evaluateFounderJourney } from "@/lib/founder-journey/evaluate";
import { requestStageApproval } from "@/lib/founder-journey/advance";

export async function POST(): Promise<NextResponse> {
  const profile = await requireRole(["founder"]);
  const supabase = await createServerSupabaseClient();

  const state = await evaluateFounderJourney(supabase, profile.id);

  if (state.pendingApproval) {
    return NextResponse.json({ error: "Already pending" }, { status: 400 });
  }

  if (!state.canRequestApproval) {
    return NextResponse.json({ error: "Requirements not met" }, { status: 400 });
  }

  await requestStageApproval(supabase, profile.id);

  return NextResponse.json({ success: true });
}
