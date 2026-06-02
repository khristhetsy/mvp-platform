import { AppShell } from "@/components/AppShell";
import { AdminActionHealthProvider } from "@/components/AdminActionHealthProvider";
import { AdminButtonHealthPanel } from "@/components/AdminButtonHealthPanel";
import { AdminEnvironmentPanel } from "@/components/admin/AdminEnvironmentPanel";
import { AdminRecoveryChecklist } from "@/components/AdminRecoveryChecklist";
import { buildOperationalSnapshot } from "@/lib/operations/system-snapshot";
import { getEnvironmentStatusSummary } from "@/lib/env";
import { requireRole } from "@/lib/supabase/auth";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminSystemHealthPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const operationalSnapshot = await buildOperationalSnapshot();
  const environmentStatus = getEnvironmentStatusSummary();
  const latestMigration = operationalSnapshot.migrations.latest;
  const migrationPrefix = latestMigration?.slice(0, 4) ?? null;
  const migrationsOk = migrationPrefix ? Number(migrationPrefix) >= 51 : false;

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

        <div className="mt-8">
          <WorkspacePanel
            title="Enterprise smoke panel (Phase 1)"
            subtitle="Deployment readiness hints — no secrets displayed"
          >
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Route checklist</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  <li>
                    ✓ <Link href="/admin/analytics" className="font-semibold text-indigo-700 hover:underline">Analytics</Link>
                  </li>
                  <li>
                    ✓ <Link href="/admin/insights" className="font-semibold text-indigo-700 hover:underline">Insights</Link>
                  </li>
                  <li>
                    ✓ <Link href="/admin/integrations" className="font-semibold text-indigo-700 hover:underline">Integrations</Link>
                  </li>
                  <li>
                    ✓ <Link href="/admin/imports" className="font-semibold text-indigo-700 hover:underline">Import / Export</Link>
                  </li>
                  <li>
                    ✓ <Link href="/admin/spvs" className="font-semibold text-indigo-700 hover:underline">SPVs</Link>
                  </li>
                  <li>
                    ✓ <Link href="/admin/actions" className="font-semibold text-indigo-700 hover:underline">Action Center</Link>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Environment & migrations</p>
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  <p>APP_ENV: <span className="font-mono">{environmentStatus.appEnv}</span></p>
                  <p>Supabase host: <span className="font-mono">{environmentStatus.supabaseProjectHost ?? "—"}</span></p>
                  <p>Service role configured: <span className="font-mono">{environmentStatus.serviceRoleConfigured ? "yes" : "no"}</span></p>
                  <p>Cron configured: <span className="font-mono">{environmentStatus.cronConfigured ? "yes" : "no"}</span></p>
                  <p>Latest migration: <span className="font-mono">{latestMigration ?? "—"}</span></p>
                  <p className={migrationsOk ? "text-emerald-800" : "text-amber-900"}>
                    {migrationsOk ? "✓ Migration floor looks OK (≥0051)" : "○ Migration floor may be behind (expected ≥0051)"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Reference:{" "}
                    <Link href="/admin/system-health" className="font-semibold text-indigo-700 hover:underline">
                      system snapshot
                    </Link>{" "}
                    ·{" "}
                    <Link href="/admin/reports" className="font-semibold text-indigo-700 hover:underline">
                      reports
                    </Link>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Cron / automation visibility</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <p>
                  Last automation run:{" "}
                  <span className="font-mono">
                    {operationalSnapshot.automation.lastAutomationRun
                      ? `${operationalSnapshot.automation.lastAutomationRun.status ?? "—"} · ${operationalSnapshot.automation.lastAutomationRun.triggerType ?? "—"}`
                      : "—"}
                  </span>
                </p>
                <p>
                  Last orchestration run:{" "}
                  <span className="font-mono">
                    {operationalSnapshot.automation.lastOrchestrationRun
                      ? `${operationalSnapshot.automation.lastOrchestrationRun.status ?? "—"} · ${operationalSnapshot.automation.lastOrchestrationRun.triggerSource ?? "—"}`
                      : "—"}
                  </span>
                </p>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Manual triggers: <span className="font-mono">POST /api/admin/run-automation-engine</span>,{" "}
                <span className="font-mono">POST /api/admin/run-digest-pass</span>.
              </p>
            </div>
          </WorkspacePanel>
        </div>
      </AdminActionHealthProvider>
    </AppShell>
  );
}
