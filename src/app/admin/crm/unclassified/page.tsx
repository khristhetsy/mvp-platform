import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { loadUnclassifiedRecords } from "@/lib/crm/load-console";
import { UnclassifiedTable } from "@/components/crm/UnclassifiedTable";

export const dynamic = "force-dynamic";

export default async function AdminUnclassifiedCrmPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const records = await loadUnclassifiedRecords({ limit: 500 }).catch(() => []);

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
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Unclassified contacts</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Mirrored contacts with no founder/investor member type and no investor profile in Odoo. They stay here until a
            member type or profile is set — set one in Odoo and the next sync routes them automatically.
          </p>
        </div>
        <UnclassifiedTable records={records} />
      </div>
    </AppShell>
  );
}
