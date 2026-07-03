import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { loadFounderRecords } from "@/lib/crm/load-console";
import { CrmConsole } from "@/components/crm/CrmConsole";

export const dynamic = "force-dynamic";

export default async function AdminFounderCrmPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const founders = await loadFounderRecords({ limit: 200 }).catch(() => []);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "#1A6CE4" }}>Private Market · CRM</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Founder CRM</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Every founder as a List, Board, or Cards view. Open any record for its Capital Readiness Rating and matching investors.
          </p>
        </div>
        <CrmConsole module="founder" founders={founders} />
      </div>
    </AppShell>
  );
}
