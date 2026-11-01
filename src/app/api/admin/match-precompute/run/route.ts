import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { computeFounderMatches } from "@/lib/matching/founder-match-store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Run the founder match precompute once, now. Admin only. Works while the
 * `match_precompute` setting is off, so the result can be checked before it is turned on.
 *   POST {"dryRun": true}   scores everything and reports, saves nothing
 *   POST {}                 saves each founder's best investors
 */
export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;
  if (auth.profile.role !== "admin") return NextResponse.json({ error: "Admin only." }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { dryRun?: boolean };
  try {
    const summary = await computeFounderMatches({ dryRun: Boolean(body.dryRun) });
    return NextResponse.json(summary, { status: summary.ok ? 200 : 500 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "Precompute failed." }, { status: 500 });
  }
}
