import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/AppShell";
import { AdminActionHealthProvider } from "@/components/AdminActionHealthProvider";
import { AdminBetaOnboardingTools } from "@/components/admin/AdminBetaOnboardingTools";
import { AdminButtonHealthPanel } from "@/components/AdminButtonHealthPanel";
import { AdminEnvironmentPanel } from "@/components/admin/AdminEnvironmentPanel";
import { AdminLaunchReadinessPanel } from "@/components/admin/AdminLaunchReadinessPanel";
import { AdminMigrationWarningBanner } from "@/components/admin/AdminMigrationWarningBanner";
import { AdminRecoveryChecklist } from "@/components/AdminRecoveryChecklist";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { getEnvironmentStatusSummary } from "@/lib/env";
import { buildLaunchReadinessSnapshot } from "@/lib/operations/launch-readiness";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminSystemHealthPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const t = await getTranslations("adminPages");
  const launchReadiness = await buildLaunchReadinessSnapshot();
  const environmentStatus = getEnvironmentStatusSummary();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
          profileEmail={profile.email ?? undefined}
    >
      <AdminActionHealthProvider
        userId={profile.id}
        userRole={profile.role}
        serviceRoleConfigured={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}
      >
        <AdminMigrationWarningBanner migrations={launchReadiness.migrations} />

        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">{t("adminWorkspace")}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">System Health</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Launch readiness, migration verification, security checks, and private beta operations. Secrets are never
            displayed.
          </p>
        </div>

        <AdminLaunchReadinessPanel snapshot={launchReadiness} />

        <div className="mt-8">
          <WorkspacePanel title={t("betaOperations2")} subtitle={t("cohortActivationAndSupport")}>
            <p className="text-sm text-slate-600">
              Monitor founder/investor activation, inactivity flags, feedback queue, and operational event stream.
            </p>
            <Link
              href="/admin/beta-operations"
              className="mt-3 inline-block rounded-lg bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white"
            >
              Open beta operations
            </Link>
          </WorkspacePanel>
        </div>

        <div className="mt-8">
          <WorkspacePanel title={t("betaOnboardingTools")} subtitle={t("generateCuratedSignupLinks")}>
            <AdminBetaOnboardingTools />
          </WorkspacePanel>
        </div>

        <div className="mt-8">
          <AdminButtonHealthPanel />
        </div>

        <div className="mt-8">
          <AdminEnvironmentPanel status={environmentStatus} />
        </div>

        <div className="mt-8">
          <AdminRecoveryChecklist snapshot={launchReadiness.operational} />
        </div>
      </AdminActionHealthProvider>
    </AppShell>
  );
}
