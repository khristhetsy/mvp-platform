import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { getPointRules } from "@/lib/icfo-events/gamification";
import { listMissions } from "@/lib/icfo-events/missions";
import { CREDITS_ENABLED } from "@/lib/icfo-events/credits";
import { PointRulesForm } from "@/components/admin-events/PointRulesForm";
import { MissionsManager } from "@/components/admin-events/MissionsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gamification" };

export default async function AdminGamificationPage() {
  const t = await getTranslations("adminPages");
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
      profileSubtitle={t("gamification")}
    >
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Points &amp; rewards</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Set how many Points each participation action is worth. Rewards are status (badges, leaderboard) and redeemable
          iCFO Points — never cash or prizes.
        </p>

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#d5e6ff] bg-[#f2f8ff] px-4 py-3 text-sm text-[#1c3d63]">
          <span aria-hidden className="text-base">💡</span>
          <p className="leading-relaxed">
            These values also fund <b>iCFO Points</b> — the redeemable, no-cash-value member balance (1:1 with the
            leaderboard). A value of <b>15</b> means an attendee earns 15 Points for that action.{" "}
            {CREDITS_ENABLED ? (
              <>Manage what Points buy in the{" "}
                <Link href="/admin/events/credits" className="font-semibold underline">Rewards catalog</Link>.</>
            ) : (
              <>The program is currently <b>disabled</b> — nothing is redeemable until it&apos;s turned on. Prepare the{" "}
                <Link href="/admin/events/credits" className="font-semibold underline">Rewards catalog</Link> now.</>
            )}{" "}
            <Link href="/legal/credits" className="font-semibold underline">Program terms</Link>.
          </p>
        </div>
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
