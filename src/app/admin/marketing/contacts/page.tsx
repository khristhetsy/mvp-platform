import { requireRole } from "@/lib/supabase/auth";
import { SalesContactsClient } from "@/app/admin/sales/contacts/SalesContactsClient";

export const dynamic = "force-dynamic";

// Marketing → Contacts now renders the universal Contacts (crm_contacts), the same
// shared, member-scoped list used by Sales and IR — instead of the separate
// marketing_contacts mirror. Marketing's Lists / campaigns / sequences plumbing is
// untouched (still crm-linked via the Phase-A mapping). Reversible.
export default async function MarketingContactsPage() {
  await requireRole(["admin", "analyst"]);
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 4px" }}>Contacts</h1>
        <p style={{ fontSize: 12, color: "#5f5e5a", margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <i className="ti ti-link" aria-hidden="true" /> One universal list shared across Sales, IR &amp; Marketing — you see only your Lead-assigned contacts (admins see all).
        </p>
      </div>
      <SalesContactsClient />
    </div>
  );
}
