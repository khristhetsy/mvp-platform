import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { IrHubHeader } from "../../IrHubTabs";
import { PipelineClient } from "./PipelineClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "IR Pipeline" };

export default async function IrProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ add?: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  const sp = await searchParams;
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Investor Relations Hub">
      <IrHubHeader />
      <PipelineClient projectId={id} meId={profile.id} openAdd={sp.add === "1"} />
    </AppShell>
  );
}
