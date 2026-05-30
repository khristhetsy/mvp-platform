import { AppShell } from "@/components/AppShell";
import { AdminSpvManagement } from "@/components/AdminSpvManagement";
import {
  listAdminCompaniesForSpv,
  listAdminSpvOpportunities,
  listSpvParticipationsForOpportunity,
} from "@/lib/spv/spv-workflow";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";
import type { SpvParticipationRecord } from "@/lib/spv/types";

export const dynamic = "force-dynamic";

export default async function AdminSpvsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const admin = createServiceRoleClient();

  const [oppsResult, companies] = await Promise.all([
    listAdminSpvOpportunities(admin),
    listAdminCompaniesForSpv(admin),
  ]);

  const opportunities = oppsResult.data ?? [];
  const participationsBySpv: Record<string, SpvParticipationRecord[]> = {};

  for (const spv of opportunities) {
    const { data } = await listSpvParticipationsForOpportunity(admin, spv.id);
    participationsBySpv[spv.id] = data ?? [];
  }

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">SPV workflow</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Create and manage SPV opportunities from marketplace interest. No legal formation, banking, or
          securities execution in this phase.
        </p>
      </div>

      <AdminSpvManagement
        opportunities={opportunities}
        participationsBySpv={participationsBySpv}
        companies={companies.map((c) => ({ id: c.id, name: c.company_name }))}
      />
    </AppShell>
  );
}
