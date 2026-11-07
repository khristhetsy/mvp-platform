import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { loadWeeklyContext } from "@/lib/private-market/weekly-data";
import { writeOptions } from "@/lib/private-market/weekly-ai-server";
import { REWRITES, TARGETS, TONES } from "@/lib/private-market/weekly-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const base = { audience: z.enum(["founder", "investor"]), agentId: z.string().uuid().nullable().optional() };
const schema = z.discriminatedUnion("action", [
  z.object({
    ...base,
    action: z.literal("write"),
    target: z.enum(TARGETS),
    tone: z.enum(TONES),
    factKeys: z.array(z.enum(["approved", "moves", "market", "gainer", "sector", "recipient"])).max(6),
    extra: z.string().max(300).default(""),
  }),
  z.object({ ...base, action: z.literal("rewrite"), rewrite: z.enum(REWRITES), text: z.string().max(600) }),
]);

/**
 * POST /api/admin/private-market/weekly-emailer/ai
 *   { action: "write", audience, agentId, target, tone, factKeys, extra }   3 options for the subject, preheader or note
 *   { action: "rewrite", audience, agentId, rewrite, text }                 one rewritten version of the selected words
 * Admins only. Facts are read from the live market numbers here, never taken from the browser.
 * Nothing is saved or sent: the admin chooses an option in the editor.
 */
export async function POST(request: Request): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the options and try again." }, { status: 400 });
  try {
    const ctx = await loadWeeklyContext();
    if (!ctx) return NextResponse.json({ error: "The market numbers could not be read, so the writer has no facts." }, { status: 503 });
    const d = parsed.data;
    const agentId = d.agentId ?? null;
    const r = await writeOptions(d.action === "write" ? { ...d, agentId } : { ...d, agentId }, ctx.market);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ options: r.options, writer: r.writer });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "The writer failed. Try again." }, { status: 500 });
  }
}
