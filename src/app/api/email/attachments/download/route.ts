import { NextRequest, NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * GET /api/email/attachments/download?path=<ownerId>/<file>
 * Redirects to a short-lived signed URL. Authorized to the file's owner only
 * (paths are namespaced by profile id).
 */
export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const path = req.nextUrl.searchParams.get("path");
  if (!path || !path.startsWith(`${auth.profile.id}/`)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin.storage.from("email-attachments").createSignedUrl(path, 300);
  if (error || !data) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.redirect(data.signedUrl);
}
