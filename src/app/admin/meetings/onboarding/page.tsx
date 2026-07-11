import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { listOnboarding, ONBOARDING_ITEMS } from "@/lib/meetings/onboarding";
import { OnboardingClient } from "./OnboardingClient";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const records = await listOnboarding();

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <OnboardingClient initial={records} items={ONBOARDING_ITEMS} />
    </AppShell>
  );
}
