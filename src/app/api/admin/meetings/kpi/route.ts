import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listDefinitions, listEntries, createDefinition, recentMondays, listAgents, listAgentEntries } from "@/lib/meetings/kpi";

export const dynamic = "force-dynamic";

// GET ?dept=<id> — KPI definitions, agent roster, and recent-week entries for the grid.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const dept = req.nextUrl.searchParams.get("dept") ?? undefined;
  const weeks = recentMondays(8);
  const definitions = await listDefinitions(dept);
  const kpiIds = definitions.map((d) => d.id);
  const [entries, agents, agentEntries] = await Promise.all([
    listEntries(kpiIds, weeks),
    dept ? listAgents(dept) : Promise.resolve([]),
    listAgentEntries(kpiIds, weeks),
  ]);
  return NextResponse.json({ definitions, weeks, entries, agents, agentEntries });
}

const defSchema = z.object({
  department_id: z.string().uuid(),
  key: z.string().min(1).max(60).regex(/^[a-z0-9_]+$/, "lower_snake_case only"),
  label: z.string().min(1).max(120),
  unit: z.enum(["count", "percent", "currency"]).optional(),
});

// POST — create a KPI definition.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = defSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A department, key (lower_snake_case), and label are required." }, { status: 400 });
  try {
    const def = await createDefinition(parsed.data.department_id, parsed.data.key, parsed.data.label, parsed.data.unit ?? "count");
    return NextResponse.json({ definition: def }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create KPI." }, { status: 500 });
  }
}
