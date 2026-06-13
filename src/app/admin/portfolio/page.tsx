import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminPortfolioPageClient } from "@/components/admin/AdminPortfolioPageClient";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminPortfolioPage() {
  const profile = await requireRole(["admin", "analyst"]);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Admin workspace"
    >
      <PageHeader
        eyebrow="Admin · Portfolio oversight"
        title="All investor portfolios"
        description="Platform-wide view of investor deal tracking. Valuations are investor-reported or synced from active deal rooms."
      />
      <AdminPortfolioPageClient />
    </AppShell>
  );
}
