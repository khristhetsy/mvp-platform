import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getRequestById } from "@/lib/esignature/requests";
import { listFields } from "@/lib/esignature/fields";
import { signatureSignedUrl } from "@/lib/esignature/storage";

export const dynamic = "force-dynamic";

/** GET — envelope detail + fields + short-lived preview URL for the working PDF. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("review_documents");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const request = await getRequestById(auth.supabase, id);
  if (!request || request.created_by !== auth.userId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const [fields, previewUrl] = await Promise.all([
    listFields(auth.supabase, id),
    signatureSignedUrl(auth.supabase, request.working_file_path, 600),
  ]);

  return NextResponse.json({ request, fields, previewUrl });
}
