import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { IrHubHeader } from "../../IrHubTabs";
import { ProjectFormClient } from "./ProjectFormClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Investor Relations Project" };

export default async function IrProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  const { tab } = await searchParams;
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Investor Relations">
      <IrHubHeader />
      <ProjectFormClient projectId={id} initialTab={tab ?? null} />
    </AppShell>
  );
}
