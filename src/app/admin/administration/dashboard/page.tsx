import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { AdministrationDashboardView } from "@/components/admin/AdministrationDashboardView";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadAdministrationDashboard } from "@/lib/dashboard/administration-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administration dashboard" };

export default async function AdminAdministrationDashboardPage() {
  const { profile } = await requirePermissionPage("manage_users");
  const d = await loadAdministrationDashboard(createServiceRoleClient()).catch(() => null);

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Administration">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-[var(--navy)]">Administration dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">One view across platform users, compliance, SPVs, approvals and billing requests.</p>
          </div>
          <Link href="/admin/users/manage" className="rounded-lg bg-[#1A6CE4] px-3 py-2 text-sm font-semibold text-white">Manage users</Link>
        </div>
        {d ? (
          <AdministrationDashboardView d={d} />
        ) : (
          <p className="mt-3 text-sm text-slate-500">The figures could not be loaded. Reload the page to try again.</p>
        )}
      </div>
    </AppShell>
  );
}
