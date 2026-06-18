import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { dashboardForRole } from "@/lib/supabase/auth";
import type { WorkspaceId } from "@/lib/workspace-nav";

function workspaceForRole(role: string): WorkspaceId | null {
  if (role === "founder") return "founder";
  if (role === "investor") return "investor";
  if (role === "admin" || role === "analyst") return "admin";
  return null;
}

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/auth/sign-in");
  }

  const workspace = workspaceForRole(profile.role);
  if (!workspace) {
    redirect(dashboardForRole(profile.role));
  }

  return (
    <AppShell
      workspace={workspace}
      profileName={profile.full_name ?? profile.email ?? "User"}
      profileSubtitle="Notifications"
    >
      <PageHeader
        eyebrow="Activity"
        title="Notifications"
        description="Unified alerts for investor activity, onboarding, remediation, learning, reviews, and billing events."
      />

      <NotificationsPanel />
    </AppShell>
  );
}
