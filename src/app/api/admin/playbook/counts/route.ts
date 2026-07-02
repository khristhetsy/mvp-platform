import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { assemblePlaybook } from "@/lib/playbook/assemble";
import { playbookCounts } from "@/lib/playbook/counts";

export const dynamic = "force-dynamic";

/** Live pending counts for modules that declare a count_source. Short-cache. */
export async function GET(): Promise<Response> {
  try {
    await requireRole(["admin", "analyst"]);
    const { cards } = await assemblePlaybook();
    const sources = cards.map((c) => c.content?.countSource).filter((s): s is string => !!s);
    const counts = await playbookCounts(sources);
    return NextResponse.json({ counts }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
