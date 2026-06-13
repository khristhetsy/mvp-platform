import { NextRequest, NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/supabase/auth";
import { listTasks, createTask, listInternalUsers } from "@/lib/tasks/db";
import type { CreateTaskInput } from "@/lib/tasks/types";

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
    const body: CreateTaskInput = await req.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

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
