import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/AppShell";
import { SignaturePrepareClient } from "@/components/admin/signatures/SignaturePrepareClient";
import { requirePermissionPage } from "@/lib/api/permissions";
import { getRequestById } from "@/lib/esignature/requests";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export default async function AdminSignaturePreparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ contract?: string }>;
}) {
  const t = await getTranslations("adminPages");
  const { profile, supabase, userId } = await requirePermissionPage("review_documents");
  const { id } = await params;
  const { contract: contractId } = await searchParams;

  const request = await getRequestById(supabase, id);
  if (!request || request.created_by !== userId) notFound();

  // Sales Hub contract upload: only when that contract owns this envelope.
  let contract: { docId: string; backHref: string } | undefined;
  if (contractId && /^[0-9a-f-]{36}$/i.test(contractId)) {
    const db = createServiceRoleClient() as unknown as SupabaseClient;
    const { data } = await db.from("contract_documents").select("id, contact_id, signature_request_id").eq("id", contractId).maybeSingle();
    if (data && data.signature_request_id === request.id) contract = { docId: data.id as string, backHref: `/admin/sales/contracts/send?contact=${data.contact_id as string}` };
  }

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("prepareDocument")}
    >
      <SignaturePrepareClient
        requestId={request.id}
        documentName={request.document_name}
        status={request.status}
        pageCount={request.page_count}
        contract={contract}
      />
    </AppShell>
  );
}
