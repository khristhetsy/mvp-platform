import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { getOpportunity, getDefaultPipeline } from "@/lib/sales/opportunities";
import { SalesHubHeader } from "../../SalesHubHeader";
import { OpportunityDetailClient } from "./OpportunityDetailClient";

export const dynamic = "force-dynamic";

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  const [opportunity, pipeline] = await Promise.all([getOpportunity(id), getDefaultPipeline()]);
  if (!opportunity) notFound();
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <OpportunityDetailClient initial={opportunity} stages={pipeline?.stages ?? []} />
    </AppShell>
  );
}
