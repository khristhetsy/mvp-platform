import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { listRequests } from "@/lib/esignature/requests";

export const dynamic = "force-dynamic";

/** GET — list the current admin's signature envelopes. */
export async function GET(): Promise<Response> {
  const auth = await requirePermissionApi("review_documents");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const requests = await listRequests(auth.supabase, auth.userId);
  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      document_name: r.document_name,
      deal_label: r.deal_label,
      status: r.status,
      signer_name: r.signer_name,
      signer_email: r.signer_email,
      page_count: r.page_count,
      created_at: r.created_at,
      sent_at: r.sent_at,
      signed_at: r.signed_at,
    })),
  });
}
