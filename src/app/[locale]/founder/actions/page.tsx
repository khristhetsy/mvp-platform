import { FounderAppShell } from "@/components/FounderAppShell";
import { ActionCenterPage } from "@/components/actions/ActionCenterPage";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderActionsPage() {
  const profile = await requireRole(["founder"]);

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"}>
      <ActionCenterPage
        role="founder"
        title="Founder Action Center"
        description="Onboarding, readiness, documents, investor engagement, and SPV awareness actions in one place."
      />
    </FounderAppShell>
  );
}
