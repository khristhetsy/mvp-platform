import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getRequestByToken } from "@/lib/esignature/public";
import { signatureSignedUrl } from "@/lib/esignature/storage";

export const dynamic = "force-dynamic";

/** GET — token-gated download of the sealed PDF (redirects to a signed URL). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const request = await getRequestByToken(supabase, token);
  if (!request || !request.signed_file_path) {
    return NextResponse.json({ error: "Signed document not available." }, { status: 404 });
  }

  const url = await signatureSignedUrl(supabase, request.signed_file_path, 300);
  if (!url) return NextResponse.json({ error: "Could not generate a download link." }, { status: 500 });

  return NextResponse.redirect(url);
}
