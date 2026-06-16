import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { TermSheetExplainer } from "@/components/founder/TermSheetExplainer";

export const dynamic = "force-dynamic";

export default async function TermSheetPage() {
  const profile = await requireRole(["founder"]);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle="Term sheet explainer"
    >
      <FounderFeatureGate featureKey="dashboard">
        <div className="mx-auto max-w-3xl space-y-6">
          <PageHeader
            eyebrow="Capital education"
            title="Term sheet explainer"
            description="Plain-English breakdown of every clause you'll encounter — with red flags and negotiation tactics."
          />
          <TermSheetExplainer />
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
