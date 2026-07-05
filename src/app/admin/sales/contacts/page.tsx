import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listAdminCompanies } from "@/lib/data/admin";
import { SalesHubHeader } from "../SalesHubHeader";
import { SalesContactsClient, type SalesContact } from "./SalesContactsClient";

export const dynamic = "force-dynamic";

export default async function SalesContactsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const admin = createServiceRoleClient();
  const companies = await listAdminCompanies(admin).catch(() => []);

  const contacts: SalesContact[] = companies
    .filter((c) => c.founder?.email || c.company_name)
    .map((c) => ({
      companyId: c.id,
      profileId: c.founder?.id ?? null,
      name: c.founder?.full_name ?? c.company_name ?? "Founder",
      email: c.founder?.email ?? "",
      company: c.company_name ?? "—",
      phone: "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <SalesContactsClient contacts={contacts} />
    </AppShell>
  );
}
