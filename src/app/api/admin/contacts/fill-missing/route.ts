/**
 * Fill missing founder and investor contact fields. Staff only.
 *   GET                                                     → { fields }  (guessable fields per role, with defaults)
 *   POST { op: "preview", role, step, guessFields?, freeMode? } → Preview (freeMode: website step without AI)
 *   POST { op: "apply",   role, step, afterId?, guessFields? } → ApplyResult (one capped slice; loop on nextCursor)
 *   POST { op: "undo",    role, step }                      → { removed }
 * See src/lib/contacts/fill-missing.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { previewFill, applyFill, undoFill, guessableFields, type Role } from "@/lib/contacts/fill-missing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const role = z.enum(["founder", "investor"]);
const step = z.enum(["contact", "website", "guess"]);
const guessFields = z.array(z.string().max(40)).max(30).optional();
const freeMode = z.boolean().optional();
const schema = z.union([
  z.object({ op: z.literal("preview"), role, step, guessFields, freeMode }),
  z.object({ op: z.literal("apply"), role, step, afterId: z.string().uuid().optional(), guessFields, freeMode }),
  z.object({ op: z.literal("undo"), role, step }),
]);

async function staff() {
  return requireRole(["admin", "analyst"]).catch(() => null);
}

export async function GET(): Promise<Response> {
  if (!(await staff())) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const fields = Object.fromEntries((["founder", "investor"] as Role[]).map((r) => [r, guessableFields(r).map((f) => ({ field: f.field, label: f.label, default: f.guess!.default }))]));
  return NextResponse.json({ fields });
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!(await staff())) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.data;
  try {
    if (body.op === "preview") return NextResponse.json(await previewFill({ role: body.role, step: body.step, guessFields: body.guessFields, freeMode: body.freeMode }));
    if (body.op === "apply") return NextResponse.json(await applyFill({ role: body.role, step: body.step, afterId: body.afterId, guessFields: body.guessFields, freeMode: body.freeMode }));
    return NextResponse.json({ removed: await undoFill(body.role, body.step) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 200) : "Failed." }, { status: 500 });
  }
}
