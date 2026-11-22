import { notFound } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { TermSheetCreatorClient } from "@/components/founder/TermSheetCreatorClient";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { DealCompanyEmptyState } from "@/components/founder/DealCompanyEmptyState";
import { resolveActingFounderScope } from "@/lib/admin/act-on-behalf";

export const dynamic = "force-dynamic";
export const metadata = { title: "Term sheet creator" };

export default async function FounderTermSheetCreatorPage() {
  // Act-on-behalf: permissioned staff render as the founder; otherwise normal gate.
  const acting = await resolveActingFounderScope();
  const profile = acting ? acting.profile : await requireRole(["founder"]);

  const supabase = await createServerSupabaseClient();
  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "term_sheet_creator")) notFound();

  const company = acting ? acting.company : (await getActiveCompanyForUser(profile)).company;
  const name = profile.full_name ?? profile.email ?? "Founder";
  if (!company) {
    return (
      <FounderAppShell profileName={name} profileSubtitle="No active raise">
        <PageHeader eyebrow="Raise Toolkit" title="Term sheet creator" description="Fill in a direct to investor term sheet from your Round structure or from scratch." />
        <DealCompanyEmptyState />
      </FounderAppShell>
    );
  }

  return (
    <FounderAppShell profileName={name} profileSubtitle="Term sheet creator">
      <FounderJourneyGate minStage="qualify">
        <PageHeader eyebrow="Raise Toolkit" title="Term sheet creator" description="Fill in a direct to investor term sheet from your Round structure or from scratch. The clauses stay as written in the template. Only the blanks change." />
        <TermSheetCreatorClient companyName={company.company_name} />
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
