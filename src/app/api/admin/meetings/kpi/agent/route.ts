import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createAgent } from "@/lib/meetings/kpi";

export const dynamic = "force-dynamic";

const schema = z.object({
  department_id: z.string().uuid(),
  name: z.string().min(1).max(120),
});

// POST — add an agent to a department's KPI roster.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A department and agent name are required." }, { status: 400 });
  try {
    const agent = await createAgent(parsed.data.department_id, parsed.data.name.trim());
    return NextResponse.json({ agent }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to add agent." }, { status: 500 });
  }
}
