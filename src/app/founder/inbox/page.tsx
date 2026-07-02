import { FounderAppShell } from "@/components/FounderAppShell";
import { InboxTabs } from "@/components/email/InboxTabs";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/supabase/auth";
import { assertFeatureEnabled } from "@/lib/feature-controls/server";

export const dynamic = "force-dynamic";

export default async function FounderInboxPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  await assertFeatureEnabled("founder", "inbox", "/founder/dashboard");
  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle={t("inbox")}>
      <InboxTabs />
    </FounderAppShell>
  );
}
