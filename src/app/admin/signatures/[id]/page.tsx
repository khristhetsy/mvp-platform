import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { SignaturePrepareClient } from "@/components/admin/signatures/SignaturePrepareClient";
import { requirePermissionPage } from "@/lib/api/permissions";
import { getRequestById } from "@/lib/esignature/requests";

export const dynamic = "force-dynamic";

export default async function AdminSignaturePreparePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { profile, supabase, userId } = await requirePermissionPage("review_documents");
  const { id } = await params;

  const request = await getRequestById(supabase, id);
  if (!request || request.created_by !== userId) notFound();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Prepare document"
    >
      <SignaturePrepareClient
        requestId={request.id}
        documentName={request.document_name}
        status={request.status}
        pageCount={request.page_count}
      />
    </AppShell>
  );
}
