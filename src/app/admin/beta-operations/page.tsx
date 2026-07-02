import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/AppShell";
import { AdminBetaOperationsDashboard } from "@/components/admin/beta/AdminBetaOperationsDashboard";
import { AdminMigrationWarningBanner } from "@/components/admin/AdminMigrationWarningBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { buildBetaOperationsSnapshot } from "@/lib/operations/beta-operations-snapshot";
import { WorkspaceModulePlaceholder } from "@/components/ui/WorkspaceModulePlaceholder";
import { isAdminModuleComingSoon } from "@/lib/admin/module-flags";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminBetaOperationsPage() {
  const profile = await requireRole(["admin", "analyst"]);

  const t = await getTranslations("adminPages");
  if (isAdminModuleComingSoon("betaOperations")) {
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
            eyebrow={t("privateBeta")}
            title={t("betaOperations")}
            description={t("staffSupervisedCohortActivation")}
          />
          <WorkspaceModulePlaceholder title={t("betaOperations2")} />
        </WorkspacePageContainer>
      </AppShell>
    );
  }

  const snapshot = await buildBetaOperationsSnapshot();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
          profileEmail={profile.email ?? undefined}
    >
      <WorkspacePageContainer>
        <AdminMigrationWarningBanner migrations={snapshot.launchReadiness.migrations} />

        <PageHeader
          eyebrow={t("privateBeta")}
          title={t("betaOperations")}
          description={t("staffSupervisedCohortActivation")}
          metadata={`See system health for launch readiness · Generated ${new Date(snapshot.generatedAt).toLocaleString("en-US")}`}
        />

        <AdminBetaOperationsDashboard snapshot={snapshot} />
      </WorkspacePageContainer>
    </AppShell>
  );
}
