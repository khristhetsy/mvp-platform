import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireStaffApi } from "@/lib/api/admin";
import { getAttachment } from "@/lib/admin-tasks/queries";
import { taskFileSignedUrl } from "@/lib/admin-tasks/storage";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attId: string }> },
): Promise<Response> {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id: taskId, attId } = await params;
    const att = await getAttachment(auth.supabase, attId);
    if (!att || att.task_id !== taskId) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });

    const disposition = req.nextUrl.searchParams.get("disposition") === "attachment" ? "attachment" : "inline";
    const url = await taskFileSignedUrl(auth.supabase, att.storage_path, 60, disposition, att.file_name);
    if (!url) return NextResponse.json({ error: "Could not create signed URL." }, { status: 500 });

    return NextResponse.json({ url });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to create signed URL." }, { status: 500 });
  }
}
