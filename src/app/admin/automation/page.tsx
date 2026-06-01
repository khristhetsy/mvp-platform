import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { AdminAutomationConsole } from "@/components/admin/automation/AdminAutomationConsole";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { loadAutomationConsole, parseAutomationConsoleFilters } from "@/lib/automation/admin-console";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminAutomationPage({ searchParams }: PageProps) {
  const profile = await requireRole(["admin", "analyst"]);
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
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Admin Workspace"
          title="Workflow automation"
          description="Monitor rules-based automation runs, dependencies, guards, and bounded manual execution."
        />
        {loadError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{loadError}</p>
        ) : payload ? (
          <Suspense fallback={<p className="text-sm text-slate-600">Loading filters…</p>}>
            <AdminAutomationConsole payload={payload} isAdmin={isAdmin} />
          </Suspense>
        ) : null}
      </WorkspacePageContainer>
    </AppShell>
  );
}
