import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { SalesHubHeader } from "../SalesHubHeader";
import { SignaturesIndexClient } from "@/components/admin/signatures/SignaturesIndexClient";

export const dynamic = "force-dynamic";

/** Sales Hub › Contracts: upload a contract (PDF or Word), place signature fields, send. */
export default async function SalesContractsPage() {
  const { profile } = await requirePermissionPage("review_documents");
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <SignaturesIndexClient />
    </AppShell>
  );
}
