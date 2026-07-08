import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { loadHubPayload } from "@/lib/playbook/hub";
import { OpsHub } from "@/components/admin/playbook/OpsHub";

export const dynamic = "force-dynamic";
export const metadata = { title: "Investor Relations Hub" };

const TABS = ["open", "core", "close", "settings"];

export default async function AdminPlaybookPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const sp = await searchParams;
  const initialTab = TABS.includes(sp.tab ?? "") ? (sp.tab as string) : "dash";
  const payload = await loadHubPayload(profile.id);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Investor Relations Hub"
      profileEmail={profile.email ?? undefined}
    >
      <OpsHub initial={payload} initialTab={initialTab} isAdmin={profile.role === "admin"} />
    </AppShell>
  );
}
