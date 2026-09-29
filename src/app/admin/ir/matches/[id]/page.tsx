import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { IrHubHeader } from "../../IrHubTabs";
import { MatchClient } from "./MatchClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Share Project" };

export default async function IrMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Investor Relations Hub">
      <IrHubHeader />
      <MatchClient matchId={id} meId={profile.id} />
    </AppShell>
  );
}
