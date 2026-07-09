import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserProfile } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/api/parse-body";
import { listTasks, createTask, listInternalUsers } from "@/lib/tasks/db";

const createTaskSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(500),
  description: z.string().max(10_000).optional(),
  assigned_to: z.string().min(1).nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  due_date: z.string().nullable().optional(),
  context_type: z.enum(["personal", "company", "deal", "internal", "marketing_plan"]).optional(),
  context_id: z.string().optional(),
  task_category: z.enum(["marketing", "ir_dept", "admin_dept", "sales_dept"]).nullable().optional(),
  task_type: z.enum(["learning", "operations", "investor_outreach", "deal_diligence"]).nullable().optional(),
});

/** GET /api/tasks
 *  Returns tasks visible to the current user (RLS-filtered).
 *  ?internal_users=1 → returns assignable internal users list instead.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const profile = await requireUserProfile();

    if (req.nextUrl.searchParams.get("internal_users") === "1") {
      // Only admins need this; non-admins get an empty list
      if (profile.role !== "admin" && profile.role !== "analyst") {
        return NextResponse.json([]);
      }
      const users = await listInternalUsers();
      return NextResponse.json(users);
    }

    const tasks = await listTasks();
    return NextResponse.json(tasks);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** POST /api/tasks — create a new task */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const profile = await requireUserProfile();
    const parsed = await parseJsonBody(req, createTaskSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    // Non-admins cannot assign tasks to other users
    if (body.assigned_to && body.assigned_to !== profile.id) {
      if (profile.role !== "admin" && profile.role !== "analyst") {
        return NextResponse.json({ error: "Only admins can assign tasks to others" }, { status: 403 });
      }
    }

    const task = await createTask(profile.id, body);
    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
