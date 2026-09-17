import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { IrHubHeader } from "../IrHubTabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Odoo import" };

/** Five-step import (export → map projects → match investors → review activities → import) lands in Phase 4. */
export default async function IrImportPage() {
  const profile = await requireRole(["admin", "analyst"]);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Investor Relations Hub">
      <IrHubHeader />
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        <p className="font-medium text-slate-900">Odoo import</p>
        <p className="mt-1">Export → map projects → match investors → review activities → import. Odoo stays read-only until cutover. This step is built after Projects, Tasks and the founder report so imported data lands in the finished model.</p>
      </div>
    </AppShell>
  );
}
