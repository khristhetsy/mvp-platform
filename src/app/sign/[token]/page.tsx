import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getRequestByToken, listFieldsForToken, markViewed } from "@/lib/esignature/public";
import { signatureSignedUrl, writeSignatureAudit } from "@/lib/esignature/storage";
import { BRAND } from "@/lib/esignature/types";
import { SignerClient } from "@/components/signatures/SignerClient";

export const dynamic = "force-dynamic";

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceRoleClient();
  const request = await getRequestByToken(supabase, token);

  if (!request) {
    return <Terminal title="Link not found" message="This signing link is invalid or has expired." />;
  }
  if (request.status === "voided") {
    return <Terminal title="Document voided" message="This document has been voided by the sender and can no longer be signed." />;
  }
  if (request.status === "completed" || request.status === "signed") {
    return <Terminal title="Already signed" message="Thank you — this document has already been completed. A copy was emailed to you." />;
  }

  // First open: record the 'opened' event + flip sent → viewed.
  if (request.status === "sent") {
    const hdrs = await headers();
    await writeSignatureAudit(supabase, {
      requestId: request.id,
      eventType: "opened",
      actor: request.signer_email ?? request.signer_name,
      ipAddress: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip"),
      userAgent: hdrs.get("user-agent"),
    });
    await markViewed(supabase, request.id);
  }

  const [fields, previewUrl] = await Promise.all([
    listFieldsForToken(supabase, request.id),
    signatureSignedUrl(supabase, request.working_file_path, 1800),
  ]);

  return (
    <SignerClient
      token={token}
      documentName={request.document_name}
      dealLabel={request.deal_label}
      signerName={request.signer_name}
      signerCompany={request.signer_company}
      consentAccepted={request.consent_accepted}
      pageCount={request.page_count}
      previewUrl={previewUrl}
      signingDate={new Date().toISOString().slice(0, 10)}
      fields={fields.map((f) => ({
        id: f.id,
        field_type: f.field_type,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        required: f.required,
        placeholder: f.placeholder,
        auto_source: f.auto_source,
      }))}
    />
  );
}

function Terminal({ title, message }: { title: string; message: string }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8F9FC", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "40px 44px", maxWidth: 460, textAlign: "center" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#534AB7", letterSpacing: "0.04em", margin: "0 0 16px" }}>{BRAND.productName}</p>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 10px" }}>{title}</h1>
        <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, margin: 0 }}>{message}</p>
      </div>
    </div>
  );
}
