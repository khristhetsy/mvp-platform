import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { SettingsSidebarNav } from "../SettingsSidebarNav";
import { TeamManagementPanel } from "@/components/founder/TeamManagementPanel";

export const dynamic = "force-dynamic";

export default async function FounderSettingsTeamPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <PageHeader
        eyebrow="Settings"
        title="Team"
        description="Invite co-founders and team members to collaborate on your fundraise."
      />

      <SettingsSidebarNav active="team" />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Team members</h2>
          <p className="mt-0.5 text-xs text-slate-500">Invite co-founders and collaborators</p>
        </div>
        <div className="p-6">
          {company ? (
            <TeamManagementPanel currentUserId={profile.id} />
          ) : (
            <p className="text-sm text-slate-500">
              Complete your company profile to invite team members.
            </p>
          )}
        </div>
      </section>
    </FounderAppShell>
  );
}
