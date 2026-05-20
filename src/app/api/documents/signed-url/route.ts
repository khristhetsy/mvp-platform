import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/data/audit";
import { createSignedDocumentUrl } from "@/lib/data/documents";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { signedDocumentUrlSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder", "admin", "analyst", "investor"]);

  if ("error" in auth) {
    return auth.error;
  }

  const parsed = signedDocumentUrlSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid document request." }, { status: 400 });
  }

  const { data: document, error: documentError } = await auth.supabase
    .from("documents")
    .select("*")
    .eq("id", parsed.data.documentId)
    .single();

  if (documentError || !document?.file_path) {
    return NextResponse.json({ error: "Document not found or inaccessible." }, { status: 404 });
  }

  const serviceSupabase = createServiceRoleClient();
  const { data, error } = await createSignedDocumentUrl(serviceSupabase, document.file_path);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "document.signed_url.created",
    entityType: "document",
    entityId: document.id,
  });

  return NextResponse.json({ signedUrl: data.signedUrl, expiresIn: 300 });
}
