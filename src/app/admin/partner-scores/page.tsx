import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { PartnerScoresClient } from "@/components/admin/PartnerScoresClient";
import { getStoredWeights } from "@/lib/investor-rating/weights";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export default async function AdminPartnerScoresPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const t = await getTranslations("usersAdmin.partnerScores");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weights = await getStoredWeights(createServiceRoleClient() as unknown as SupabaseClient<any>);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <WorkspacePageContainer>
        <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("desc")} />
        <PartnerScoresClient initialWeights={weights} />
      </WorkspacePageContainer>
    </AppShell>
  );
}
