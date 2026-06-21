import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { SignatureSendClient } from "@/components/admin/signatures/SignatureSendClient";
import { requirePermissionPage } from "@/lib/api/permissions";
import { getRequestById } from "@/lib/esignature/requests";

export const dynamic = "force-dynamic";

export default async function AdminSignatureSendPage({
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
      profileSubtitle="Send for signature"
    >
      <SignatureSendClient requestId={request.id} documentName={request.document_name} />
    </AppShell>
  );
}
