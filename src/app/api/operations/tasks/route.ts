import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listTasks, createTask, listAssignees } from "@/lib/operations/tasks";

export const dynamic = "force-dynamic";

// GET /api/operations/tasks?entityType=&entityId= — tasks for a record + assignees.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const entityType = sp.get("entityType");
  const entityId = sp.get("entityId");
  if (!entityType || !entityId) return NextResponse.json({ error: "entityType and entityId required." }, { status: 400 });
  const [tasks, assignees] = await Promise.all([listTasks(entityType, entityId), listAssignees()]);
  return NextResponse.json({ tasks, assignees });
}

const createSchema = z.object({
  title: z.string().min(1).max(300),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

// POST /api/operations/tasks — create + assign a task.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid task." }, { status: 400 });
  const task = await createTask({ ...parsed.data, createdBy: profile.id });
  return NextResponse.json({ task });
}
