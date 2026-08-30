import { AppShell } from "@/components/AppShell";
import { FormdContactsPanel } from "@/components/crm/FormdContactsPanel";
import { formatError } from "@/lib/errors/format-error";
import { listFormdPromotedContacts, type FormdContact } from "@/lib/formd/contacts";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminCrmContactsPage() {
  const profile = await requireRole(["admin", "analyst"]);

  let setupError: string | null = null;
  let contacts: FormdContact[] = [];

  try {
    const supabase = createServiceRoleClient();
    contacts = await listFormdPromotedContacts(supabase);
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Investor relations</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Contacts</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Founders and investors promoted from the Form D Desk. Investors join the distribution list; founders enter
          the CRM. Records are screened against OFAC and SEC before promotion.
        </p>
      </div>

      {setupError ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Data load failed: {setupError}
        </div>
      ) : null}

      <FormdContactsPanel contacts={contacts} />
    </AppShell>
  );
}
