import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { getOpportunity, getDefaultPipeline } from "@/lib/sales/opportunities";
import { getContactProfile } from "@/lib/sales/contacts";
import { listAssignableStaff } from "@/lib/sales/settings";
import { SalesHubHeader } from "../../SalesHubHeader";
import { OpportunityDetailClient } from "./OpportunityDetailClient";
import type { MirrorContact } from "./FounderProfileMirror";

export const dynamic = "force-dynamic";

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  const [opportunity, pipeline, staff] = await Promise.all([getOpportunity(id), getDefaultPipeline(), listAssignableStaff()]);
  if (!opportunity) notFound();

  // Carry the linked contact's Founder Profile onto the deal (read-only mirror).
  const founderContact: MirrorContact | null = opportunity.contact_crm_id
    ? ((await getContactProfile(opportunity.contact_crm_id))?.contact as MirrorContact | undefined) ?? null
    : null;

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <OpportunityDetailClient initial={opportunity} stages={pipeline?.stages ?? []} founderContact={founderContact} staff={staff} />
    </AppShell>
  );
}
