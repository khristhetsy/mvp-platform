import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { getSequences } from "@/lib/marketing/sequences";
import { getTemplates } from "@/lib/marketing/templates";
import { getLists } from "@/lib/marketing/contacts";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEffectivePermissions } from "@/lib/rbac/effective-permissions";
import type { Profile } from "@/lib/supabase/types";
import { SequencesClient } from "./SequencesClient";
import { SequenceApprovals } from "./SequenceApprovals";

export const dynamic = "force-dynamic";

export default async function MarketingSequencesPage() {
  const t = await getTranslations("adminPages");
  const profile = (await requireRole(["admin"])) as Profile & { is_super_admin?: boolean };
  const effective = await getEffectivePermissions(createServiceRoleClient(), profile.id, profile);
  const canApprove = effective.isSuperAdmin || effective.permissions.includes("manage_actions");

  const [sequences, templates, lists] = await Promise.all([
    getSequences(),
    getTemplates(),
    getLists(),
  ]);
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 500 }}>{t("sequences")}</h1>
      </div>
      <SequenceApprovals canApprove={canApprove} />
      <SequencesClient sequences={sequences} templates={templates} lists={lists} />
    </div>
  );
}
