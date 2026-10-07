import { NextRequest, NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { signedSupportUrl } from "@/lib/support/attachments";
import type { SupportAttachment } from "@/lib/support/support";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Open a support attachment: /api/support/attachment?message=<id>&i=<index>.
 * Staff can open any; a founder only files on their own request's non-internal
 * messages. Redirects to a 60 second signed link.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const messageId = req.nextUrl.searchParams.get("message") ?? "";
  const index = Number(req.nextUrl.searchParams.get("i") ?? "0");
  const db = createServiceRoleClient() as unknown as SupabaseClient;
  const { data: msg } = await db.from("support_messages").select("request_id, is_internal, attachments").eq("id", messageId).maybeSingle();
  const m = msg as { request_id: string; is_internal: boolean; attachments: SupportAttachment[] | null } | null;
  const file = m?.attachments?.[index];
  if (!m || !file) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const staff = auth.profile.role === "admin" || auth.profile.role === "analyst";
  if (!staff) {
    if (m.is_internal) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const { data: r } = await db.from("support_requests").select("founder_id").eq("id", m.request_id).maybeSingle();
    if ((r as { founder_id: string } | null)?.founder_id !== auth.profile.id) return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const url = await signedSupportUrl(file.path, file.name);
  return url ? NextResponse.redirect(url) : NextResponse.json({ error: "Couldn't open the file." }, { status: 500 });
}
