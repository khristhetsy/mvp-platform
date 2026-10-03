import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { SalesHubHeader } from "../../SalesHubHeader";
import { ContractDocumentClient } from "@/components/admin/contracts/ContractDocumentClient";

export const dynamic = "force-dynamic";

/** One contract document: editor while a draft; tracking, activity and countersign once sent. */
export default async function ContractDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <ContractDocumentClient id={id} defaultSignerName={profile.full_name ?? ""} />
    </AppShell>
  );
}
