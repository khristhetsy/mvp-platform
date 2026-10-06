import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { isSuperAdmin } from "@/lib/rbac/effective-permissions";
import { SalesContactsClient } from "@/app/admin/sales/contacts/SalesContactsClient";
import { ContactsPageHeader } from "./ContactsPageHeader";

export const dynamic = "force-dynamic";

/**
 * Contacts on its own page (Home tile, sidebar, top menu): the same shared list as
 * Sales hub > Contacts, without the Sales hub title and tabs. Records still open at
 * /admin/sales/contacts/[id].
 */
export default async function ContactsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <ContactsPageHeader />
      <SalesContactsClient canBulkAssign={isSuperAdmin(profile)} canBulkEdit canExport={profile.role === "admin"} canMerge odooSearch />
    </AppShell>
  );
}
