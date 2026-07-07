import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { loadHubPayload } from "@/lib/playbook/hub";

export const dynamic = "force-dynamic";

// GET /api/admin/playbook/advisory — recompute suggestions (client refresh).
export async function GET(): Promise<Response> {
  try {
    const profile = await requireRole(["admin", "analyst"]);
    const payload = await loadHubPayload(profile.id);
    return NextResponse.json({ suggestions: payload.suggestions });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
