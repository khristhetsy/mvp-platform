import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { ConnectorsPanel } from "@/components/crm/ConnectorsPanel";
import { SyncCrmToMarketing } from "@/components/crm/SyncCrmToMarketing";
import { AddContactsCard } from "@/components/crm/AddContactsCard";

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
        <div className="mt-4"><AddContactsCard /></div>
        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-4 text-sm shadow-[var(--shadow-panel)]">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Pipeline</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <a href="/admin/crm/brief" className="font-semibold text-[#1A6CE4] hover:underline">Brief →</a>
            <a href="/admin/crm/classify" className="font-semibold text-[#1A6CE4] hover:underline">1 · Classify →</a>
            <a href="/admin/crm/verify" className="font-semibold text-[#1A6CE4] hover:underline">2 · Verify &amp; append →</a>
            <a href="/admin/crm/audience" className="font-semibold text-[#1A6CE4] hover:underline">3 · Audience &amp; approach →</a>
            <a href="/admin/crm/publish" className="font-semibold text-[#1A6CE4] hover:underline">4 · Publish →</a>
          </div>
        </div>
        {profile.role === "admin" && <div className="mt-4"><SyncCrmToMarketing /></div>}
      </div>
    </AppShell>
  );
}
