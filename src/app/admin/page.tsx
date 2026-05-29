import { AppShell } from "@/components/AppShell";
import { AdminDashboardShell } from "@/components/AdminDashboardShell";
import type { AdminCompanyCardData } from "@/components/AdminCompanyCard";
import { getAdminDashboardMetrics, listAdminCompanies } from "@/lib/data/admin";
import { listAdminInvestorActivity } from "@/lib/data/investor-interests";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export default async function AdminDashboardPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const supabase = createServiceRoleClient();

  const [metrics, companies, investorActivity] = await Promise.all([
    getAdminDashboardMetrics(supabase),
    listAdminCompanies(supabase),
    listAdminInvestorActivity(supabase),
  ]);

  const pendingCompanies = companies.filter((company) => company.review_status === "pending");

  const companyCards: AdminCompanyCardData[] = companies.map((company) => {
    const latestReview = company.admin_reviews[0];
    const pitchDeck = company.documents.find((doc) => doc.document_type?.toUpperCase() === "PITCH_DECK");

    return {
      id: company.id,
      company_name: company.company_name,
      industry: company.industry,
      review_status: company.review_status,
      is_published: company.is_published ?? false,
      marketplace_visible: company.marketplace_visible ?? false,
      published_at: company.published_at ?? null,
      slug: company.slug,
      business_description: company.business_description,
      created_at: company.created_at,
      founder_name: company.founder?.full_name ?? "Unknown founder",
      founder_email: company.founder?.email ?? "—",
      pitch_deck_url: company.pitchDeckUrl,
      pitch_deck_id: pitchDeck?.id ?? null,
      documents: company.documents,
      initial_feedback:
        latestReview?.feedback ?? latestReview?.requested_changes ?? latestReview?.notes ?? "",
    };
  });

  return (
    <AppShell role="ADMIN">
      <AdminDashboardShell
        userId={profile.id}
        userRole={profile.role}
        serviceRoleConfigured={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}
        metrics={metrics}
        pendingCount={pendingCompanies.length}
        companyCards={companyCards}
        investorActivity={investorActivity}
      />
    </AppShell>
  );
}
