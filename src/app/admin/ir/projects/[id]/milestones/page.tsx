import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { IrHubHeader } from "../../../IrHubTabs";
import { MilestonesClient } from "./MilestonesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "IR Milestones" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Investor Relations Hub">
      <IrHubHeader />
      <MilestonesClient projectId={id} />
    </AppShell>
  );
}
