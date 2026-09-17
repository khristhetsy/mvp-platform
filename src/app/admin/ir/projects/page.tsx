import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { IrHubHeader } from "../IrHubTabs";
import { ProjectsClient } from "./ProjectsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "IR Projects" };

export default async function IrProjectsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Investor Relations Hub">
      <IrHubHeader />
      <ProjectsClient meId={profile.id} />
    </AppShell>
  );
}
