import { AppShell } from "@/components/AppShell";
import { SignaturesIndexClient } from "@/components/admin/signatures/SignaturesIndexClient";
import { requirePermissionPage } from "@/lib/api/permissions";

export const dynamic = "force-dynamic";

export default async function AdminSignaturesPage() {
  const { profile } = await requirePermissionPage("review_documents");

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="E-signatures"
    >
      <SignaturesIndexClient />
    </AppShell>
  );
}
