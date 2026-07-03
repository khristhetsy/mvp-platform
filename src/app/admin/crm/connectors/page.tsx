import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { ConnectorsPanel } from "@/components/crm/ConnectorsPanel";

export const dynamic = "force-dynamic";

export default async function CrmConnectorsPage() {
  const profile = await requireRole(["admin", "analyst"]);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "#1A6CE4" }}>Private Market · CRM</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Contact connectors — import &amp; sync</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            External systems remain the system of record. Contacts mirror into the CRM for fast views. Run a one-time full import, then an incremental sync keeps the mirror fresh.
          </p>
        </div>
        <ConnectorsPanel />
      </div>
    </AppShell>
  );
}
