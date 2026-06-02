import { NextResponse } from "next/server";
import { runScheduledDigestPass } from "@/lib/notifications/scheduled/digest-scheduler";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;

  if (auth.profile.role !== "admin" && auth.profile.role !== "analyst") {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";

  try {
    const supabase = createServiceRoleClient();
    const result = await runScheduledDigestPass(supabase, { force });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : "Digest pass failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
