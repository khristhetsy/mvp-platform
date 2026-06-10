import { AppShell } from "@/components/AppShell";
import { PageBuilderLab } from "@/components/page-builder/PageBuilderLab";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspaceModulePlaceholder } from "@/components/ui/WorkspaceModulePlaceholder";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requirePageBuilderPage } from "@/lib/api/permissions";
import { isAdminModuleComingSoon } from "@/lib/admin/module-flags";

export const dynamic = "force-dynamic";

export default async function PageBuilderLabPage() {
  const { profile } = await requirePageBuilderPage();

  if (isAdminModuleComingSoon("pageBuilderLab")) {
    return (
      <AppShell
        role="ADMIN"
        workspace="admin"
        profileName={profile.full_name ?? profile.email ?? "Admin"}
        profileSubtitle={profile.role}
          profileEmail={profile.email ?? undefined}
      >
        <WorkspacePageContainer>
          <PageHeader
            eyebrow="Admin workspace"
            title="Page Builder Lab"
            description="Compose and preview institutional workspace layouts."
          />
          <WorkspaceModulePlaceholder title="Page builder" />
        </WorkspacePageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
          profileEmail={profile.email ?? undefined}
    >
      <PageBuilderLab />
      <p className="mt-6 text-xs text-slate-500">
        Signed in as {profile.email ?? profile.full_name ?? profile.id}
      </p>
    </AppShell>
  );
}
