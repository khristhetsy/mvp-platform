import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { loadHubPayload } from "@/lib/playbook/hub";
import { OpsHub } from "@/components/admin/playbook/OpsHub";
import { IrLifecycleCard } from "@/components/admin/IrLifecycleCard";
import { investorLifecycle, founderLifecycle } from "@/lib/lifecycle/counts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Investor Relations Hub" };

const TABS = ["dash", "analytics", "open", "core", "close", "settings"];

export default async function AdminPlaybookPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const sp = await searchParams;
  const initialTab = TABS.includes(sp.tab ?? "") ? (sp.tab as string) : "dash";
  const [payload, investorStages, founderStages] = await Promise.all([
    loadHubPayload(profile.id),
    investorLifecycle(),
    founderLifecycle(),
  ]);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Investor Relations Hub"
      profileEmail={profile.email ?? undefined}
    >
      <div style={{ marginBottom: 16 }}>
        <IrLifecycleCard investorStages={investorStages} founderStages={founderStages} />
      </div>
      <OpsHub initial={payload} initialTab={initialTab} isAdmin={profile.role === "admin"} />
    </AppShell>
  );
}
