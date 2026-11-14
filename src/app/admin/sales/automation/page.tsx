import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { getDefaultPipeline } from "@/lib/sales/opportunities";
import { listRules, listPendingApprovals } from "@/lib/sales/automation";
import { SalesHubHeader } from "../SalesHubHeader";
import { AutomationClient } from "./AutomationClient";

export const dynamic = "force-dynamic";

export default async function SalesAutomationPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const [pipeline, rules, approvals] = await Promise.all([getDefaultPipeline(), listRules(), listPendingApprovals()]);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <AutomationClient stages={pipeline?.stages ?? []} initialRules={rules} initialApprovals={approvals} />
    </AppShell>
  );
}
