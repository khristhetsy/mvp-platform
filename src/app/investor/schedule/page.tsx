import { AppShell } from "@/components/AppShell";
import { AvailabilityEditor } from "@/components/calendar/AvailabilityEditor";
import { getTranslations } from "next-intl/server";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { assertFeatureEnabled } from "@/lib/feature-controls/server";

export const dynamic = "force-dynamic";

export default async function InvestorSchedulePage() {
  const { profile } = await requireInvestorWorkspaceSession();
  const t = await getTranslations("appPages");
  await assertFeatureEnabled("investor", "scheduling", "/investor/dashboard");
  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle={t("scheduling")}
    >
      <AvailabilityEditor bookingPath={`/schedule/${profile.id}`} />
    </AppShell>
  );
}
