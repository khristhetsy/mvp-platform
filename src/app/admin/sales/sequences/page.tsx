import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { SalesHubHeader } from "../SalesHubHeader";
import { getSequences } from "@/lib/marketing/sequences";
import { getTemplates } from "@/lib/marketing/templates";
import { getLists } from "@/lib/marketing/contacts";
import { getMarketingSettings } from "@/lib/marketing/settings";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEffectivePermissions } from "@/lib/rbac/effective-permissions";
import type { Profile } from "@/lib/supabase/types";
import { SequencesClient } from "@/app/admin/marketing/sequences/SequencesClient";
import { SequenceApprovals } from "@/app/admin/marketing/sequences/SequenceApprovals";

export const dynamic = "force-dynamic";

// Sales Hub → Sequences. Renders the exact Marketing → Sequences experience
// (same banner, approvals, and builder) inside the Sales Hub shell, over the same
// data — one source of truth. Only difference is the surrounding hub chrome.
export default async function SalesSequencesPage() {
  const t = await getTranslations("adminPages");
  const profile = (await requireRole(["admin", "analyst"])) as Profile & { is_super_admin?: boolean };
  const effective = await getEffectivePermissions(createServiceRoleClient(), profile.id, profile);
  const canApprove = effective.isSuperAdmin || effective.permissions.includes("manage_actions");

  const [sequences, templates, lists, sender] = await Promise.all([
    getSequences(),
    getTemplates(),
    getLists(),
    getMarketingSettings().catch(() => null),
  ]);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <SalesHubHeader />
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h1 style={{ fontSize: 18, fontWeight: 500 }}>{t("sequences")}</h1>
        </div>
        <SequenceApprovals canApprove={canApprove} />
        <SequencesClient
          sequences={sequences}
          templates={templates}
          lists={lists}
          defaultSender={sender ? { name: sender.default_from_name, email: sender.default_from_email } : undefined}
        />
      </div>
    </AppShell>
  );
}
