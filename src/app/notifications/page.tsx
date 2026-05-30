import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { NotificationsPanel } from "@/components/NotificationsPanel";
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
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Activity</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Notifications</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Unified alerts for investor activity, onboarding, remediation, learning, reviews, and billing events.
        </p>
      </div>

      <NotificationsPanel />
    </AppShell>
  );
}
