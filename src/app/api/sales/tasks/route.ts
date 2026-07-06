import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listTasks, createTask } from "@/lib/sales/tasks";

export const dynamic = "force-dynamic";

// GET /api/sales/tasks?scope=my|all|overdue — sales tasks/activities.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const scope = (req.nextUrl.searchParams.get("scope") as "my" | "all" | "overdue" | null) ?? "all";
  const opportunityId = req.nextUrl.searchParams.get("opportunityId");
  const contactCrmId = req.nextUrl.searchParams.get("contactCrmId");
  const tasks = await listTasks({ scope, assigneeId: profile.id, opportunityId, contactCrmId });
  return NextResponse.json({ tasks });
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  taskType: z.string().max(40).optional(),
  summary: z.string().max(2000).optional().nullable(),
  dueDate: z.string().max(20).optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  opportunityId: z.string().uuid().optional().nullable(),
  contactCrmId: z.string().max(120).optional().nullable(),
  contactName: z.string().max(200).optional().nullable(),
});

// POST /api/sales/tasks — create a task/activity.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A task title is required." }, { status: 400 });
  try {
    const assigneeId = parsed.data.assigneeId ?? profile.id;
    const task = await createTask({ ...parsed.data, assigneeId, createdBy: profile.id });
    return NextResponse.json({ task });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Create failed." }, { status: 500 });
  }
}
