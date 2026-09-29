/**
 * Rebuild the /fit match index. Staff-only.
 *   GET  → { size }                          current row count
 *   POST → { scanned, written, removed }     full rebuild
 * The rebuild does the wide crm_contacts scan on purpose, so the request path never has
 * to. See src/lib/fit/match-index.ts.
 */
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { rebuildMatchIndex, matchIndexSize } from "@/lib/fit/match-index";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  return NextResponse.json({ size: await matchIndexSize() });
}

export async function POST(req: Request): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  // ?full=1 forces a complete reprojection (needed for the very first build, and after a
  // bulk change like an enrichment approval sweep). Default is incremental.
  const full = new URL(req.url).searchParams.get("full") === "1";
  return NextResponse.json(await rebuildMatchIndex({ full }));
}
