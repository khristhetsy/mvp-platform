import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePermissionApi } from "@/lib/api/permissions";
import { buildStudioRulesPatch, mapStudioRules } from "@/lib/icfo-events/studio";

export const dynamic = "force-dynamic";

/** Save the Studio playout rules for one event. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const built = buildStudioRulesPatch(await req.json().catch(() => null));
  if ("error" in built) return NextResponse.json({ error: built.error }, { status: 400 });

  const { id } = await params;
  const { data, error } = await (auth.supabase as unknown as SupabaseClient)
    .from("events")
    .update(built.patch)
    .eq("id", id)
    .select("spotlight_break_seconds")
    .single();
  if (error) {
    return NextResponse.json({ error: "Couldn't save. The playout rules update must be applied first." }, { status: 500 });
  }
  return NextResponse.json({ rules: mapStudioRules(data as Record<string, unknown>) });
}
