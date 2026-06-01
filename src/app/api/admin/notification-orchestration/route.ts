import { NextResponse } from "next/server";
import { runNotificationOrchestration } from "@/lib/notifications/orchestration/orchestrator";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function POST() {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;

  if (auth.profile.role !== "admin" && auth.profile.role !== "analyst") {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

  try {
    const supabase = createServiceRoleClient();
    const result = await runNotificationOrchestration(supabase, { includeInactivity: true });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Orchestration failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
