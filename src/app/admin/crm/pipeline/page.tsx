import { AppShell } from "@/components/AppShell";
import { AdminInvestorPipelinePanel } from "@/components/admin/AdminInvestorPipelinePanel";
import { formatError } from "@/lib/errors/format-error";
import { listAdminInvestorPipeline } from "@/lib/investor-crm/admin-pipeline";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminCrmPipelinePage() {
  const profile = await requireRole(["admin", "analyst"]);

  let setupError: string | null = null;
  let pipelineRows: Awaited<ReturnType<typeof listAdminInvestorPipeline>> = [];

  try {
    const supabase = createServiceRoleClient();
    pipelineRows = await listAdminInvestorPipeline(supabase);
  } catch (error) {
    setupError = formatError(error);
  }

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">CRM</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Pipeline</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Investor–company pipeline status across all active deal relationships.
        </p>
      </div>

      {setupError ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Data load failed: {setupError}
        </div>
      ) : null}

      <AdminInvestorPipelinePanel rows={pipelineRows} />
    </AppShell>
  );
}
