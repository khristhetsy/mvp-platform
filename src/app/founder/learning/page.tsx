import { AppShell } from "@/components/AppShell";
import { WorkspaceModulePlaceholder } from "@/components/WorkspaceModulePlaceholder";
import { requireRole } from "@/lib/supabase/auth";

export default async function FounderLearningPage() {
  await requireRole(["founder"]);

  return (
    <AppShell role="FOUNDER" workspace="founder">
      <WorkspaceModulePlaceholder
        title="Learning"
        description="Founder education tailored to diligence gaps, readiness improvements, and capital preparation."
        futureItems={[
          "AI-generated learning paths based on diligence gaps",
          "Guided modules for disclosures, traction, and data room completeness",
          "Progress tracking tied to readiness score improvements",
        ]}
      />
    </AppShell>
  );
}
