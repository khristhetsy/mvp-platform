import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getInvestorMatchConfig } from "@/lib/settings/platform-settings";
import { compareFounder, summarize } from "@/lib/matching/prefilter-compare";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Read only check for the match prefilter: for each founder, the top 50 investors the
 * board shows today against the top 50 from the short list, scored by the same engine.
 *
 *   GET ?company=<id>           one founder
 *   GET ?offset=0&limit=5       founders in batches (default 5), so the database is never
 *                               asked to read the whole network for every founder at once
 *
 * Admin only. Works while the `match_prefilter` setting is off; it does not change it.
 */
export async function GET(request: Request) {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;
  if (auth.profile.role !== "admin") return NextResponse.json({ error: "Admin only." }, { status: 403 });

  const url = new URL(request.url);
  const companyId = url.searchParams.get("company");
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const limit = Math.min(10, Math.max(1, Number(url.searchParams.get("limit")) || 5));

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceRoleClient() as any;
    const query = db.from("companies").select("*");
    const { data, error } = companyId
      ? await query.eq("id", companyId)
      : await query.order("id", { ascending: true }).range(offset, offset + limit - 1);
    if (error) return NextResponse.json({ error: "Could not read founders." }, { status: 500 });

    const config = await getInvestorMatchConfig();
    const rows = [];
    // One founder at a time: each old read is a few thousand rows.
    for (const company of (data ?? []) as Array<{ id: string }>) {
      rows.push(await compareFounder(company as Parameters<typeof compareFounder>[0], config.engineWeights));
    }
    return NextResponse.json({ offset: companyId ? 0 : offset, limit: companyId ? 1 : limit, summary: summarize(rows), rows });
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : "Comparison failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
