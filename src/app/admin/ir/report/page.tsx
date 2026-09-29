import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { IrHubHeader } from "../IrHubTabs";
import { ReportsLandingClient } from "./ReportsLandingClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Founder report" };

export default async function IrReportsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Investor Relations Hub">
      <IrHubHeader />
      <ReportsLandingClient />
    </AppShell>
  );
}
