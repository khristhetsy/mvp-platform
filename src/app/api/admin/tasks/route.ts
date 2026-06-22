import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireStaffApi } from "@/lib/api/admin";
import { track } from "@/lib/analytics/posthog";
import { createTaskSchema, listQuerySchema } from "@/lib/admin-tasks/schemas";
import { createTask, listTasks } from "@/lib/admin-tasks/queries";
import { logActivity } from "@/lib/admin-tasks/activity";
import type { TaskStatus } from "@/lib/admin-tasks/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sp = req.nextUrl.searchParams;
    const parsed = listQuerySchema.safeParse({
      status: sp.get("status") ?? undefined,
      assignee: sp.get("assignee") ?? undefined,
      q: sp.get("q") ?? undefined,
    });
    const filters = parsed.success ? parsed.data : {};
    const tasks = await listTasks(auth.supabase, filters as { status?: TaskStatus; assignee?: string; q?: string });
    return NextResponse.json({ tasks });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load tasks." }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const parsed = createTaskSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const task = await createTask(auth.supabase, auth.profile.id, parsed.data);
    await logActivity(auth.supabase, task.id, auth.profile.id, "created", { payload: { title: task.title } });
    track("admin_task_created", { userId: auth.profile.id, taskId: task.id, status: task.status });
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to create task." }, { status: 500 });
  }
}
