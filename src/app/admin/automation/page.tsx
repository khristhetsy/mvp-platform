import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/AppShell";
import { AdminAutomationConsole } from "@/components/admin/automation/AdminAutomationConsole";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageErrorAlert } from "@/components/ui/PageErrorAlert";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { loadAutomationConsole, parseAutomationConsoleFilters } from "@/lib/automation/admin-console";
import { WorkspaceModulePlaceholder } from "@/components/ui/WorkspaceModulePlaceholder";
import { isAdminModuleComingSoon } from "@/lib/admin/module-flags";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminAutomationPage({ searchParams }: PageProps) {
  const profile = await requireRole(["admin", "analyst"]);

  const t = await getTranslations("adminPages");
  if (isAdminModuleComingSoon("automation")) {
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
            eyebrow={t("adminWorkspace")}
            title={t("workflowAutomation")}
            description={t("monitorRulesBasedAutomation")}
          />
          <WorkspaceModulePlaceholder title={t("automationEngine")} />
        </WorkspacePageContainer>
      </AppShell>
    );
  }

  const params = await searchParams;
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") urlParams.set(key, value);
    else if (Array.isArray(value) && value[0]) urlParams.set(key, value[0]);
  }

  const filters = parseAutomationConsoleFilters(urlParams);
  const supabase = createServiceRoleClient();

  let payload: Awaited<ReturnType<typeof loadAutomationConsole>> | null = null;
  let loadError: string | null = null;

  try {
    payload = await loadAutomationConsole(supabase, filters);
  } catch (error) {
    loadError = error instanceof Error ? error.message.slice(0, 200) : "Unable to load automation console.";
  }

  const isAdmin = profile.role === "admin";

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
          eyebrow={t("adminWorkspace")}
          title={t("workflowAutomation")}
          description={t("monitorRulesBasedAutomation")}
        />
        {loadError ? (
          <PageErrorAlert message={loadError} />
        ) : payload ? (
          <Suspense fallback={<p className="text-sm text-slate-600">Loading filters…</p>}>
            <AdminAutomationConsole payload={payload} isAdmin={isAdmin} />
          </Suspense>
        ) : null}
      </WorkspacePageContainer>
    </AppShell>
  );
}
