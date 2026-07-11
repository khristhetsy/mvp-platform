import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listSessionTasks, createMeetingTask } from "@/lib/meetings/tasks";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const session = req.nextUrl.searchParams.get("session");
  if (!session) return NextResponse.json({ error: "session is required." }, { status: 400 });
  return NextResponse.json({ tasks: await listSessionTasks(session) });
}

const createSchema = z.object({
  title: z.string().min(1).max(300),
  department_id: z.string().uuid().nullable().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  priority: z.enum(["urgent", "high", "med", "low"]).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  session_id: z.string().uuid().nullable().optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A task title is required." }, { status: 400 });
  try {
    const task = await createMeetingTask(parsed.data, profile.id);
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create task." }, { status: 500 });
  }
}
