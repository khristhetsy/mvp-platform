import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { uploadFounderDocument, NotAMemberError } from "@/lib/diligence/founder-actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

/** POST — founder uploads a data-room document (optionally against a doc request). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File exceeds the 25 MB limit." }, { status: 400 });

  const docRequestId = typeof form?.get("doc_request_id") === "string" ? (form.get("doc_request_id") as string) : null;
  const responseId = typeof form?.get("response_id") === "string" ? (form.get("response_id") as string) : null;

  try {
    const { documentId } = await uploadFounderDocument(
      createServiceRoleClient(),
      id,
      auth.profile.id,
      { bytes: Buffer.from(await file.arrayBuffer()), filename: file.name || "document", contentType: file.type || "application/octet-stream" },
      { docRequestId, responseId },
    );
    return NextResponse.json({ documentId });
  } catch (err) {
    if (err instanceof NotAMemberError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed." }, { status: 500 });
  }
}
