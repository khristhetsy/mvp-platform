/**
 * Saved IR auto sequences (beside the built-in ones in code).
 *   GET  → { templates: [{ id, name, steps, stop_on }] }  (empty until migration 20260930105243 is applied)
 *   POST { name, steps: [{ day, subject, body }], stopOn } → { template }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { db } from "@/lib/ir/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { data, error } = await db().from("ir_sequence_templates").select("id, name, steps, stop_on").order("created_at", { ascending: true });
  if (error) return NextResponse.json({ templates: [], setupNeeded: true });
  return NextResponse.json({ templates: data ?? [] });
}

const schema = z.object({
  name: z.string().trim().min(1, "Name the sequence.").max(120),
  steps: z.array(z.object({
    day: z.number().int().min(0).max(365),
    subject: z.string().trim().min(1, "Every step needs a subject.").max(300),
    body: z.string().trim().min(1, "Every step needs a body.").max(20000),
  })).min(1, "Add at least one step.").max(20),
  stopOn: z.array(z.enum(["reply", "meeting"])).default(["reply", "meeting"]),
});

export async function POST(req: NextRequest): Promise<Response> {
  const me = await irStaff();
  if (!me) return forbidden();
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the sequence and try again." }, { status: 400 });
  const d = parsed.data;
  const steps = [...d.steps].sort((a, b) => a.day - b.day);
  try {
    const { data, error } = await db().from("ir_sequence_templates").insert({ name: d.name, steps, stop_on: d.stopOn, created_by: me.id }).select("id, name, steps, stop_on").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ template: data }, { status: 201 });
  } catch (e) { return failed(e, "Couldn't save the sequence."); }
}
