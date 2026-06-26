import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getPointRules } from "@/lib/icfo-events/gamification";
import { listMissions } from "@/lib/icfo-events/missions";
import { PointRulesForm } from "@/components/admin-events/PointRulesForm";
import { MissionsManager } from "@/components/admin-events/MissionsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gamification" };

export default async function AdminGamificationPage() {
  const { profile } = await requirePermissionPage("manage_events");
  const admin = createServiceRoleClient();
  const [rules, missions] = await Promise.all([
    getPointRules(admin).catch(() => null),
    listMissions(admin).catch(() => []),
  ]);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Gamification"
    >
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Gamification points</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Set how many points each participation action is worth. Rewards are status (badges, leaderboard) — never prizes.
        </p>
        {rules ? (
          <PointRulesForm initialRules={rules} />
        ) : (
          <p className="mt-6 text-sm text-rose-700">Couldn&apos;t load point rules.</p>
        )}
        <MissionsManager initialMissions={missions} />
      </div>
    </AppShell>
  );
}
