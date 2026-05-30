import { AppShell } from "@/components/AppShell";
import { WorkspaceModulePlaceholder } from "@/components/WorkspaceModulePlaceholder";
import { requireRole } from "@/lib/supabase/auth";

export default async function AdminDiligencePage() {
  await requireRole(["admin", "analyst"]);

  return (
    <AppShell role="ADMIN" workspace="admin">
      <WorkspaceModulePlaceholder
        title="Diligence"
        description="Review readiness scores, uploaded documents, and AI diligence outputs for submitted companies."
        futureItems={[
          "Readiness and AI diligence review queue",
          "Document completeness and pitch deck review",
          "Diligence summaries, risk flags, and analyst notes",
        ]}
        relatedHref="/admin/dashboard"
        relatedLabel="Review companies on admin dashboard"
      />
    </AppShell>
  );
}
