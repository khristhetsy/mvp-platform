import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminActionHealthProvider } from "@/components/AdminActionHealthProvider";
import { AdminCompanyWorkspace } from "@/components/admin/company-workspace/AdminCompanyWorkspace";
import { AppShell } from "@/components/AppShell";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { getAdminCompanyWorkspace } from "@/lib/admin/company-workspace";
import { formatError } from "@/lib/errors/format-error";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveCompanyDependencies } from "@/lib/automation/dependencies";
import { loadAndMergeNextBestActions } from "@/lib/next-best-actions/lifecycle";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function AdminCompanyWorkspacePage({ params }: PageProps) {
  const { companyId } = await params;
  const profile = await requireRole(["admin", "analyst"]);
  const supabase = await createServerSupabaseClient();
  const adminRole = profile.role === "analyst" ? "analyst" : "admin";
  const serviceRoleConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  let loadError: string | null = null;
  let workspace = null;
  let companyActions = null;
  let workflowDependencies: Awaited<ReturnType<typeof resolveCompanyDependencies>> = [];

  try {
    workspace = await getAdminCompanyWorkspace(companyId);
    workflowDependencies = await resolveCompanyDependencies(supabase, companyId).catch(() => []);
    companyActions = await loadAndMergeNextBestActions({
      profile,
      supabase,
      options: {
        role: adminRole,
        entityType: "company",
        entityId: companyId,
        limit: 3,
        sync: true,
      },
    });
  } catch (error) {
    loadError = formatError(error);
  }

  if (!loadError && !workspace) {
    notFound();
  }

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
    >
      <AdminActionHealthProvider
        userId={profile.id}
        userRole={profile.role}
        serviceRoleConfigured={serviceRoleConfigured}
      >
        <WorkspacePageContainer>
          {loadError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
              Failed to load company workspace: {loadError}
            </div>
          ) : workspace ? (
            <>
              <div className="mb-2">
                <Link href="/admin/companies" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                  ← All companies
                </Link>
              </div>
              <AdminCompanyWorkspace
                data={workspace}
                nextBestActions={companyActions?.actions ?? []}
                workflowDependencies={workflowDependencies}
                adminRole={adminRole}
              />
            </>
          ) : null}
        </WorkspacePageContainer>
      </AdminActionHealthProvider>
    </AppShell>
  );
}
