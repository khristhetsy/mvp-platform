import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { FormDDeskTabs } from "@/components/crm/FormDDeskTabs";

export const dynamic = "force-dynamic";

export default async function FormDReviewPage() {
  const profile = await requireRole(["admin", "analyst"]);
  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Link href="/admin/crm/connectors" className="text-xs font-medium text-slate-500 hover:text-slate-800">← Connectors</Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Form D Desk</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">One build, two modes. Founders: scored issuer filings to promote into Contacts. Investors: funds and principals visibly deploying capital, rolled up from the same filings.</p>
        <div className="mt-4">
          <FormDDeskTabs canPromote={profile.role === "admin"} />
        </div>
      </div>
    </AppShell>
  );
}
