import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DiligenceWorkspaceClient } from "@/components/diligence/DiligenceWorkspaceClient";
import { requirePermissionPage } from "@/lib/api/permissions";
import { getEngagement } from "@/lib/diligence/data";

export const dynamic = "force-dynamic";

export default async function AdminDiligenceWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { profile, supabase } = await requirePermissionPage("manage_diligence");
  const { id } = await params;

  const engagement = await getEngagement(supabase, id);
  if (!engagement) notFound();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Diligence workspace"
    >
      <DiligenceWorkspaceClient engagementId={engagement.id} />
    </AppShell>
  );
}
