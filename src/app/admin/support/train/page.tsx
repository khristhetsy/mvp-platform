import { AppShell } from "@/components/AppShell";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { SupportTrainClient } from "@/components/admin/support/SupportTrainClient";
import { DEFAULT_BRIEF_TEMPLATE } from "@/lib/support/assistant-prompt";
import { getBriefTemplate, listGaps, listSources, listTaughtAnswers } from "@/lib/support/assistant-training";

export const dynamic = "force-dynamic";
export const metadata = { title: "Train assistant" };

/**
 * Admin, Support, Train assistant: teach the in app support assistant what
 * founders ask. Product knowledge, taught answers, PDFs, the questions it could
 * not answer, and a test chat that answers exactly as a founder would see it.
 */
export default async function AdminSupportTrainPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const [saved, taught, sources] = await Promise.all([getBriefTemplate(), listTaughtAnswers(), listSources()]);
  const gaps = await listGaps(taught);

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role}>
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Support"
          title="Train assistant"
          description="Teach the in app support assistant what founders ask. It answers only from what you add here, the live price list and the founder's own menu."
        />
        <SupportTrainClient
          canEdit={profile.role === "admin"}
          defaultBrief={DEFAULT_BRIEF_TEMPLATE}
          initialBrief={saved}
          initialTaught={taught}
          initialSources={sources}
          initialGaps={gaps}
        />
      </WorkspacePageContainer>
    </AppShell>
  );
}
