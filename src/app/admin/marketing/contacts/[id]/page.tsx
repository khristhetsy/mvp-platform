import { notFound } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { loadContactPageProps } from "@/lib/sales/contact-page-data";
import { ContactProfileClient } from "@/app/admin/sales/contacts/[id]/ContactProfileClient";

export const dynamic = "force-dynamic";

// Marketing → Contacts opens the same universal contact (crm_contacts) as Sales,
// but stays inside the Marketing Hub shell (provided by the marketing layout) and
// links back to Marketing Contacts — no jump to the Sales Hub.
export default async function MarketingContactPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  const props = await loadContactPageProps(profile, id);
  if (!props) notFound();

  return (
    <div style={{ padding: 24 }}>
      <ContactProfileClient {...props} basePath="/admin/marketing/contacts" />
    </div>
  );
}
