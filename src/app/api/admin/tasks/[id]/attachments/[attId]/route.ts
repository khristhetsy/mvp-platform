import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireStaffApi } from "@/lib/api/admin";
import { deleteAttachmentRow, getAttachment } from "@/lib/admin-tasks/queries";
import { logActivity } from "@/lib/admin-tasks/activity";
import { removeTaskFiles } from "@/lib/admin-tasks/storage";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attId: string }> },
): Promise<Response> {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id: taskId, attId } = await params;
    const att = await getAttachment(auth.supabase, attId);
    if (!att || att.task_id !== taskId) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });

    await removeTaskFiles(auth.supabase, [att.storage_path, att.original_storage_path ?? ""]);
    await deleteAttachmentRow(auth.supabase, attId);
    await logActivity(auth.supabase, taskId, auth.profile.id, "attachment_removed", { payload: { file_name: att.file_name } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to remove attachment." }, { status: 500 });
  }
}
