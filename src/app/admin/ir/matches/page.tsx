import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { IrHubHeader } from "../IrHubTabs";
import { MatchesListClient } from "./MatchesListClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Share Project" };

export default async function IrMatchesPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { project } = await searchParams;
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Investor Relations">
      <IrHubHeader />
      <MatchesListClient initialProject={project ?? ""} />
    </AppShell>
  );
}
