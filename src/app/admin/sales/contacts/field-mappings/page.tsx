import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { TARGET_FIELDS } from "@/lib/contacts/field-mapping";
import { loadCustomFields, loadSavedMappings } from "@/lib/contacts/field-mapping-store";
import { FieldMappingsClient } from "./FieldMappingsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Field mappings" };

export default async function FieldMappingsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const [saved, customFields] = await Promise.all([loadSavedMappings(), loadCustomFields()]);
  const targets = TARGET_FIELDS.map(({ key, label, group }) => ({ key, label, group }));
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Field mappings" profileEmail={profile.email ?? undefined}>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="text-[12px] text-[var(--text-muted)]"><Link href="/admin/sales/contacts" className="hover:underline">Contacts</Link> · Field mappings</div>
        <h1 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Field mappings</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">How each column of an imported file lands in iCapOS. These are saved when you import with &ldquo;Remember these mappings&rdquo; on. A change applies to the next import only; contacts already imported keep their values. Remove a mapping and that column is asked about again on the next import.</p>
        <div className="mt-5"><FieldMappingsClient initialSaved={saved} customFields={customFields} targets={targets} /></div>
      </div>
    </AppShell>
  );
}
