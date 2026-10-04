import { notFound } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEffectivePermissions } from "@/lib/rbac/effective-permissions";
import type { Profile } from "@/lib/supabase/types";
import { emailConfigured } from "@/lib/marketing/send";
import { getPartnerSequence, listPartnerEnrollments, senderDefaults } from "@/lib/marketing/partner-outreach/store";
import { PartnerSequenceEditor } from "./PartnerSequenceEditor";

export const dynamic = "force-dynamic";

// Admin › Marketing Hub › Sequences › Partner outreach (new or existing).
export default async function PartnerSequencePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = (await requireRole(["admin"])) as Profile & { is_super_admin?: boolean };
  const { id } = await params;
  const effective = await getEffectivePermissions(createServiceRoleClient(), profile.id, profile);
  const canActivate = effective.isSuperAdmin || effective.permissions.includes("manage_actions");
  if (id === "new") {
    return (
      <div style={{ padding: 24 }}>
        <PartnerSequenceEditor initial={null} partners={[]} canActivate={canActivate} resendReady={emailConfigured()} defaults={await senderDefaults()} />
      </div>
    );
  }
  const seq = await getPartnerSequence(id);
  if (!seq) notFound();
  const partners = await listPartnerEnrollments(id);
  return (
    <div style={{ padding: 24 }}>
      <PartnerSequenceEditor initial={seq} partners={partners} canActivate={canActivate} resendReady={emailConfigured()} defaults={seq.config.sender} />
    </div>
  );
}
