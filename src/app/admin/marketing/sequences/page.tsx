import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { getSequences } from "@/lib/marketing/sequences";
import { getTemplates } from "@/lib/marketing/templates";
import { getLists } from "@/lib/marketing/contacts";
import { getMarketingSettings } from "@/lib/marketing/settings";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEffectivePermissions } from "@/lib/rbac/effective-permissions";
import type { Profile } from "@/lib/supabase/types";
import { SequencesClient } from "./SequencesClient";
import { SequenceApprovals } from "./SequenceApprovals";
import { DeliveryHealthBanner } from "@/components/marketing/DeliveryHealthBanner";

export const dynamic = "force-dynamic";

export default async function MarketingSequencesPage() {
  const t = await getTranslations("adminPages");
  const profile = (await requireRole(["admin"])) as Profile & { is_super_admin?: boolean };
  const effective = await getEffectivePermissions(createServiceRoleClient(), profile.id, profile);
  const canApprove = effective.isSuperAdmin || effective.permissions.includes("manage_actions");

  const [sequences, templates, lists, sender] = await Promise.all([
    getSequences(),
    getTemplates(),
    getLists(),
    getMarketingSettings().catch(() => null),
  ]);
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 500 }}>{t("sequences")}</h1>
      </div>
      <DeliveryHealthBanner />
      <SequenceApprovals canApprove={canApprove} />
      <SequencesClient sequences={sequences} templates={templates} lists={lists} defaultSender={sender ? { name: sender.default_from_name, email: sender.default_from_email } : undefined} />
    </div>
  );
}
