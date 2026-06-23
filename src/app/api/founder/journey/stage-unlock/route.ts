import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

function raw(s: unknown): SupabaseClient {
  return s as SupabaseClient;
}

async function currentStage(supabase: SupabaseClient, profileId: string): Promise<string> {
  const { data } = await raw(supabase).from("profiles").select("journey_stage").eq("id", profileId).maybeSingle();
  return (data as { journey_stage?: string } | null)?.journey_stage ?? "initialize";
}

/** GET — the founder's current stage and the stage they've acknowledged. */
export async function GET(): Promise<Response> {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stage = await currentStage(auth.supabase, auth.profile.id);
  const { data } = await raw(auth.supabase)
    .from("user_preferences")
    .select("acknowledged_stage")
    .eq("profile_id", auth.profile.id)
    .maybeSingle();
  const acknowledged = (data as { acknowledged_stage?: string | null } | null)?.acknowledged_stage ?? null;
  return NextResponse.json({ stage, acknowledged });
}

/** POST — mark the current stage as acknowledged (dismiss the unlock banner). */
export async function POST(): Promise<Response> {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stage = await currentStage(auth.supabase, auth.profile.id);
  await raw(auth.supabase)
    .from("user_preferences")
    .upsert({ profile_id: auth.profile.id, acknowledged_stage: stage, updated_at: new Date().toISOString() }, { onConflict: "profile_id" });
  return NextResponse.json({ ok: true, acknowledged: stage });
}
