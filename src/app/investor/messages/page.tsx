import { AppShell } from "@/components/AppShell";
import { WorkspaceModulePlaceholder } from "@/components/WorkspaceModulePlaceholder";
import { requireRole } from "@/lib/supabase/auth";

export default async function InvestorMessagesPage() {
  await requireRole(["investor"]);

  return (
    <AppShell role="INVESTOR" workspace="investor">
      <WorkspaceModulePlaceholder
        title="Messages"
        description="Future workspace for founder and investor communication within CapitalOS."
        futureItems={[
          "Secure messaging with founders and platform team",
          "Thread history tied to deals and intro requests",
          "Notification preferences for new messages",
        ]}
      />
    </AppShell>
  );
}
