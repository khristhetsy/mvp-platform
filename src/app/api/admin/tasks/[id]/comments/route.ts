import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireStaffApi } from "@/lib/api/admin";
import { commentSchema } from "@/lib/admin-tasks/schemas";
import { getTaskRow } from "@/lib/admin-tasks/queries";
import { logActivity } from "@/lib/admin-tasks/activity";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const parsed = commentSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Comment is required." }, { status: 400 });

    const task = await getTaskRow(auth.supabase, id);
    if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });

    await logActivity(auth.supabase, id, auth.profile.id, "comment_added", { comment: parsed.data.text });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to add comment." }, { status: 500 });
  }
}
