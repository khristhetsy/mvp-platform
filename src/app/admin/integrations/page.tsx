import { AppShell } from "@/components/AppShell";
import { AdminIntegrationsConsole } from "@/components/admin/integrations/AdminIntegrationsConsole";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { EmailFoundationSection } from "@/components/admin/integrations/EmailFoundationSection";
import { getGmailFoundationStatus } from "@/lib/email/preferences";
import { loadIntegrationsAdminConsole } from "@/lib/integrations/admin-console";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminIntegrationsPage() {
  const profile = await requireRole(["admin", "analyst"]);

  let payload: Awaited<ReturnType<typeof loadIntegrationsAdminConsole>> | null = null;
  let loadError: string | null = null;

  const supabase = await createServerSupabaseClient();
  const emailFoundation = await getGmailFoundationStatus(supabase, profile.id);

  try {
    payload = await loadIntegrationsAdminConsole();
  } catch (error) {
    loadError = error instanceof Error ? error.message.slice(0, 200) : "Unable to load integrations.";
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
          eyebrow="Admin Workspace"
          title="External integrations"
          description="Enterprise connectivity foundation — Slack and signed webhooks with sanitized outbound events, delivery logs, and audit visibility."
        />
        <EmailFoundationSection status={emailFoundation} />
        {loadError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{loadError}</p>
        ) : payload ? (
          <AdminIntegrationsConsole payload={payload} isAdmin={profile.role === "admin"} />
        ) : null}
      </WorkspacePageContainer>
    </AppShell>
  );
}
