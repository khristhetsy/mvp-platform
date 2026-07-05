import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { SalesHubHeader } from "../SalesHubHeader";
import { PipelineClient } from "./PipelineClient";

export const dynamic = "force-dynamic";

export default async function SalesPipelinePage() {
  const profile = await requireRole(["admin", "analyst"]);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <PipelineClient />
    </AppShell>
  );
}
