import { AppShell } from "@/components/AppShell";
import { AdminActionHealthProvider } from "@/components/AdminActionHealthProvider";
import { AdminButtonHealthPanel } from "@/components/AdminButtonHealthPanel";
import { AdminEnvironmentPanel } from "@/components/admin/AdminEnvironmentPanel";
import { AdminRecoveryChecklist } from "@/components/AdminRecoveryChecklist";
import { buildOperationalSnapshot } from "@/lib/operations/system-snapshot";
import { getEnvironmentStatusSummary } from "@/lib/env";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminSystemHealthPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const operationalSnapshot = await buildOperationalSnapshot();
  const environmentStatus = getEnvironmentStatusSummary();

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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">System Health</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Admin API diagnostics, service role status, and integration monitoring.
          </p>
        </div>

        <AdminButtonHealthPanel />

        <div className="mt-8">
          <AdminEnvironmentPanel status={environmentStatus} />
        </div>

        <div className="mt-8">
          <AdminRecoveryChecklist snapshot={operationalSnapshot} />
        </div>
      </AdminActionHealthProvider>
    </AppShell>
  );
}
