import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/AppShell";
import { AdminDepartmentDashboard } from "@/components/admin/dashboard/AdminDepartmentDashboard";
import { loadAdminDashboard } from "@/lib/dashboard/admin-dashboard";
import { createServiceRoleClient, serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";
import { getEffectivePermissions } from "@/lib/rbac/effective-permissions";
import { canSeeCard } from "@/lib/rbac/dashboard-cards";
import { getPersonalDashboard } from "@/lib/dashboard/personal";
import { PersonalDashboard } from "@/components/admin/PersonalDashboard";
import { PanelSkeleton } from "@/components/route-boundaries/RouteSegmentLoading";

export const dynamic = "force-dynamic";

async function DepartmentDashboardSection() {
  const data = await loadAdminDashboard(serviceRoleClientUntyped());
  return <AdminDepartmentDashboard data={data} />;
}

export default async function AdminDashboardPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const t = await getTranslations("admin.dashboard");
  const supabase = createServiceRoleClient();

  // Resolve the viewer's effective permissions (role defaults + per-user overrides + super-admin).
  // This is controlled entirely from /admin/users/permissions, with no separate config.
  const { permissions, isSuperAdmin } = await getEffectivePermissions(supabase, profile.id, profile);

  // Only the super admin sees the org-wide dashboard. Every other member gets a personal
  // dashboard scoped to their own activity.
  if (!isSuperAdmin) {
    const data = await getPersonalDashboard(profile.id);
    return (
      <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Member"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
        <PersonalDashboard name={profile.full_name ?? profile.email ?? "there"} data={data} />
      </AppShell>
    );
  }

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role}
          profileEmail={profile.email ?? undefined}>
      <div className="mb-6 border-b border-slate-200 px-1 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{t("eyebrow")}</p>
            <h1 className="mt-0.5 text-[22px] font-medium tracking-tight text-slate-950">{t("title")}</h1>
          </div>
          <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "#E6F1FB", color: "#1A6CE4" }}>
            {profile.role}
          </span>
        </div>
      </div>
      {canSeeCard("department_dashboard", permissions) ? (
        <div className="mb-6 px-1">
          <Suspense fallback={<PanelSkeleton />}>
            <DepartmentDashboardSection />
          </Suspense>
        </div>
      ) : null}
    </AppShell>
  );
}
