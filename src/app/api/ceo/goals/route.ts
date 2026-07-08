import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listGoals, createGoal } from "@/lib/ceo/planning";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(1).max(200),
  metric: z.string().max(120).nullable().optional(),
  target: z.number().nullable().optional(),
  current: z.number().optional(),
  period: z.string().max(60).nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function GET(): Promise<Response> {
  try {
    await requireRole(["admin"]);
    return NextResponse.json({ goals: await listGoals() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireRole(["admin"]);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    return NextResponse.json(await createGoal(parsed.data));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
