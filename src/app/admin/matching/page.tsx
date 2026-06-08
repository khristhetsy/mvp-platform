import { AppShell } from "@/components/AppShell";
import { AdminMatchingCenterPanel } from "@/components/admin/AdminMatchingCenterPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { formatError } from "@/lib/errors/format-error";
import { loadAdminMatchingCenterSnapshot } from "@/lib/matching/matching-center";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminMatchingPage() {
  const profile = await requireRole(["admin", "analyst"]);

  let setupError: string | null = null;
  let snapshot: Awaited<ReturnType<typeof loadAdminMatchingCenterSnapshot>> | null = null;

  try {
    snapshot = await loadAdminMatchingCenterSnapshot();
  } catch (error) {
    setupError = formatError(error);
  }

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Admin workspace"
          title="Matching Center"
          description="Platform-wide investor–company matching intelligence using the existing CapitalOS rules engine."
        />

        {setupError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{setupError}</p>
        ) : snapshot ? (
          <AdminMatchingCenterPanel snapshot={snapshot} />
        ) : null}
      </WorkspacePageContainer>
    </AppShell>
  );
}
