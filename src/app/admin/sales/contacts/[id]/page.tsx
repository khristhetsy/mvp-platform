import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { getContactProfile } from "@/lib/sales/contacts";
import { SalesHubHeader } from "../../SalesHubHeader";
import { ContactProfileClient } from "./ContactProfileClient";

export const dynamic = "force-dynamic";

export default async function ContactProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  const data = await getContactProfile(id);
  if (!data) notFound();
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <ContactProfileClient contact={data.contact} opportunities={data.opportunities} />
    </AppShell>
  );
}
