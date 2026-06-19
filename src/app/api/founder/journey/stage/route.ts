import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { JOURNEY_STAGES } from "@/lib/founder-journey/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profile = await requireRole(["founder"]);
    const supabase = await createServerSupabaseClient();

    type ProfileRow = { journey_stage: string | null };
    const { data } = (await supabase
      .from("profiles")
      .select("journey_stage")
      .eq("id", profile.id)
      .maybeSingle()) as { data: ProfileRow | null };

    const rawStage = data?.journey_stage ?? "initialize";
    const stage = (JOURNEY_STAGES as readonly string[]).includes(rawStage)
      ? rawStage
      : "initialize";

    return NextResponse.json({ stage });
  } catch {
    return NextResponse.json({ stage: "initialize" }, { status: 200 });
  }
}
