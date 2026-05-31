import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminActionHealthProvider } from "@/components/AdminActionHealthProvider";
import { AdminInvestorWorkspace } from "@/components/admin/investor-workspace/AdminInvestorWorkspace";
import { AppShell } from "@/components/AppShell";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { getAdminInvestorWorkspace } from "@/lib/admin/investor-workspace";
import { formatError } from "@/lib/errors/format-error";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ investorId: string }>;
};

export default async function AdminInvestorWorkspacePage({ params }: PageProps) {
  const { investorId } = await params;
  const profile = await requireRole(["admin", "analyst"]);
  const serviceRoleConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  let loadError: string | null = null;
  let workspace = null;

  try {
    workspace = await getAdminInvestorWorkspace(investorId);
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
              Failed to load investor workspace: {loadError}
            </div>
          ) : workspace ? (
            <>
              <div className="mb-2">
                <Link href="/admin/investors" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                  ← All investors
                </Link>
              </div>
              <AdminInvestorWorkspace data={workspace} />
            </>
          ) : null}
        </WorkspacePageContainer>
      </AdminActionHealthProvider>
    </AppShell>
  );
}
