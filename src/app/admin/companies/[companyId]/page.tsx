import { FieldDisplayProvider } from "@/lib/profile-fields/display-provider";
import { loadSurfaceDisplay } from "@/lib/profile-fields/display-store";
import { VocabularyProvider } from "@/lib/vocabulary/provider";
import { loadVocabularies } from "@/lib/vocabulary/store";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminActionHealthProvider } from "@/components/AdminActionHealthProvider";
import { AdminCompanyWorkspace } from "@/components/admin/company-workspace/AdminCompanyWorkspace";
import { OpenAsFounderControl } from "@/components/admin/OpenAsFounderControl";
import { AccountManagerControl } from "@/components/admin/AccountManagerControl";
import { AppShell } from "@/components/AppShell";
import { WorkspaceLoadingSkeleton } from "@/components/admin/company-workspace/WorkspaceLoadingSkeleton";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { getAdminCompanyWorkspace } from "@/lib/admin/company-workspace";
import { formatError } from "@/lib/errors/format-error";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { resolveCompanyDependencies } from "@/lib/automation/dependencies";
import { getUserPlan } from "@/lib/subscriptions/get-subscription";
import { founderEntitlements } from "@/lib/subscriptions/entitlements";
import { loadAndMergeNextBestActions } from "@/lib/next-best-actions/lifecycle";
import { computeCompanyReadinessRiskSignals } from "@/lib/predictive-intelligence/readiness-risk";
import type { RiskSignal } from "@/lib/predictive-intelligence/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ companyId: string }>;
};

// Reverse-link the founder to their CRM contact (contacts map to founders by
// email, see /admin/sales/contacts/[id]). Powers the "User Profile" tab.
async function findFounderContactId(email: string | null, serviceRoleConfigured: boolean): Promise<string | null> {
  if (!email || !serviceRoleConfigured) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createServiceRoleClient() as any;
    const { data: c } = await admin.from("crm_contacts").select("id").eq("email", email).limit(1);
    return c?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

// Investor access is a paid entitlement, used to plan-gate the reach-out card's
// upgrade note (Basic and up can distribute; Free cannot).
async function findFounderCanDistribute(founderId: string | null, serviceRoleConfigured: boolean): Promise<boolean> {
  if (!founderId || !serviceRoleConfigured) return false;
  try {
    const plan = await getUserPlan(founderId);
    return founderEntitlements(plan).canDistribute;
  } catch {
    return false;
  }
}

/** The company name and industry only: one small lookup so the page can open at once. */
async function loadShellLabel(companyId: string): Promise<{ exists: boolean; name: string | null; industry: string | null }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createServiceRoleClient() as any;
    const { data, error } = await admin.from("companies").select("company_name, industry").eq("id", companyId).maybeSingle();
    if (error) return { exists: true, name: null, industry: null };
    if (!data) return { exists: false, name: null, industry: null };
    return { exists: true, name: data.company_name ?? null, industry: data.industry ?? null };
  } catch {
    return { exists: true, name: null, industry: null };
  }
}

type BodyProps = {
  companyId: string;
  profile: Awaited<ReturnType<typeof requireRole>>;
};

async function WorkspaceBody({ companyId, profile }: Readonly<BodyProps>) {
  const supabase = await createServerSupabaseClient();
  const adminRole = profile.role === "analyst" ? "analyst" : "admin";
  const serviceRoleConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  let loadError: string | null = null;
  let workspace = null;
  let companyActions = null;
  let workflowDependencies: Awaited<ReturnType<typeof resolveCompanyDependencies>> = [];
  let companyRiskSignals: RiskSignal[] = [];

  try {
    // None of these three needs another's result, so they load together.
    [workspace, workflowDependencies, companyActions] = await Promise.all([
      getAdminCompanyWorkspace(companyId),
      resolveCompanyDependencies(supabase, companyId).catch(() => []),
      loadAndMergeNextBestActions({
        profile,
        supabase,
        options: {
          role: adminRole,
          entityType: "company",
          entityId: companyId,
          limit: 3,
          sync: true,
        },
      }),
    ]);
    if (workspace) {
      companyRiskSignals = computeCompanyReadinessRiskSignals({ companyId, workspace });
    }
  } catch (error) {
    loadError = formatError(error);
  }

  if (!loadError && !workspace) {
    notFound();
  }

  // The contact link, the plan and the two display settings are independent of
  // each other, so they load together once the workspace is in.
  const [founderContactId, founderCanDistribute, vocabularies, surfaceDisplay] = await Promise.all([
    findFounderContactId(workspace?.founder?.email ?? null, serviceRoleConfigured),
    findFounderCanDistribute(workspace?.founder?.id ?? null, serviceRoleConfigured),
    workspace ? loadVocabularies() : Promise.resolve(null),
    workspace ? loadSurfaceDisplay("admin_editors") : Promise.resolve(null),
  ]);

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Failed to load company workspace: {loadError}
      </div>
    );
  }

  if (!workspace) return null;

  return (
    <VocabularyProvider value={vocabularies as Awaited<ReturnType<typeof loadVocabularies>>}>
      <FieldDisplayProvider value={surfaceDisplay as Awaited<ReturnType<typeof loadSurfaceDisplay>>}>
        <AccountManagerControl companyId={companyId} canEdit={adminRole === "admin"} />
        <OpenAsFounderControl founderId={workspace.founder?.id ?? null} founderName={workspace.founder?.full_name ?? null} />
        <AdminCompanyWorkspace
          data={workspace}
          nextBestActions={companyActions?.actions ?? []}
          workflowDependencies={workflowDependencies}
          adminRole={adminRole}
          riskSignals={companyRiskSignals}
          founderContactId={founderContactId}
          founderCanDistribute={founderCanDistribute}
        />
      </FieldDisplayProvider>
    </VocabularyProvider>
  );
}

export default async function AdminCompanyWorkspacePage({ params }: PageProps) {
  const { companyId } = await params;
  const profile = await requireRole(["admin", "analyst"]);
  const serviceRoleConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const shell = serviceRoleConfigured ? await loadShellLabel(companyId) : { exists: true, name: null, industry: null };

  if (!shell.exists) {
    notFound();
  }

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
        serviceRoleConfigured={serviceRoleConfigured}
      >
        <WorkspacePageContainer>
          <div className="mb-2">
            <Link href="/admin/companies" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
              ← All companies
            </Link>
          </div>
          <Suspense fallback={<WorkspaceLoadingSkeleton name={shell.name} industry={shell.industry} />}>
            <WorkspaceBody companyId={companyId} profile={profile} />
          </Suspense>
        </WorkspacePageContainer>
      </AdminActionHealthProvider>
    </AppShell>
  );
}
