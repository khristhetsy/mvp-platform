import { AppShell } from "@/components/AppShell";
import { DiligencePipelineClient } from "@/components/diligence/DiligencePipelineClient";
import { requirePermissionPage } from "@/lib/api/permissions";

export const dynamic = "force-dynamic";

export default async function AdminDiligencePage() {
  const { profile } = await requirePermissionPage("manage_diligence");

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Diligence"
    >
      <DiligencePipelineClient />
    </AppShell>
  );
}
