import { AppShell } from "@/components/AppShell";
import { ActionCenterPage } from "@/components/actions/ActionCenterPage";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminActionsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const adminRole = profile.role === "analyst" ? "analyst" : "admin";

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
    >
      <ActionCenterPage
        role={adminRole}
        title="Admin Action Center"
        description="Company reviews, investor approvals, compliance escalations, SPV blockers, and operational follow-ups."
      />
    </AppShell>
  );
}
