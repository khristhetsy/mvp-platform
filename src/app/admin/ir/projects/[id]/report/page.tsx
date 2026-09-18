import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { IrHubHeader } from "../../../IrHubTabs";
import { ReportClient } from "./ReportClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Founder report" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Investor Relations Hub">
      <IrHubHeader />
      <ReportClient projectId={id} meName={profile.full_name ?? profile.email ?? "Investor Relations"} />
    </AppShell>
  );
}
