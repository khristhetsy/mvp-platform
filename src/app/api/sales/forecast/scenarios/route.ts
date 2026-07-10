import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listScenarios, createScenario, cloneScenario } from "@/lib/forecast/store";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return NextResponse.json({ scenarios: await listScenarios() });
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(["base", "upside", "downside", "custom"]).optional(),
  notes: z.string().max(2000).optional().nullable(),
  cloneFrom: z.string().uuid().optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A scenario name is required." }, { status: 400 });
  try {
    const scenario = parsed.data.cloneFrom
      ? await cloneScenario(parsed.data.cloneFrom, parsed.data.name, profile.id)
      : await createScenario(parsed.data, profile.id);
    return NextResponse.json({ scenario }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create scenario." }, { status: 500 });
  }
}
