import { AppShell } from "@/components/AppShell";
import { AdminActionHealthProvider } from "@/components/AdminActionHealthProvider";
import { AdminButtonHealthPanel } from "@/components/AdminButtonHealthPanel";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminSystemHealthPage() {
  const profile = await requireRole(["admin", "analyst"]);

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
        serviceRoleConfigured={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}
      >
        <div className="mb-8">
          <p className="workspace-eyebrow">Admin Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">System Health</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Admin API diagnostics, service role status, and integration monitoring.
          </p>
        </div>

        <AdminButtonHealthPanel />
      </AdminActionHealthProvider>
    </AppShell>
  );
}
