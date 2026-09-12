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

export async function POST(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  return NextResponse.json(await rebuildMatchIndex());
}
