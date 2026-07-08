import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { loadCeoPayload } from "@/lib/ceo/hub-data";
import { CeoHub } from "@/components/ceo/CeoHub";

export const dynamic = "force-dynamic";
export const metadata = { title: "CEO Hub" };

const TABS = ["dash", "sales", "marketing", "operations", "planning", "log", "settings"];

export default async function CeoHubPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const profile = await requireRole(["admin"]);
  const sp = await searchParams;
  const initialTab = TABS.includes(sp.tab ?? "") ? (sp.tab as string) : "dash";
  const payload = await loadCeoPayload();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="CEO Hub"
      profileEmail={profile.email ?? undefined}
    >
      <CeoHub initial={payload} initialTab={initialTab} />
    </AppShell>
  );
}
