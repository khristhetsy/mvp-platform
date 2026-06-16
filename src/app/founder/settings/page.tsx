import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { requireRole } from "@/lib/supabase/auth";
import { CollaborationDiscussionPanel } from "@/components/collaboration/CollaborationDiscussionPanel";
import { CompanySettingsForm } from "./settings-form";
import { SettingsSidebarNav } from "./SettingsSidebarNav";

export const dynamic = "force-dynamic";

export default async function FounderSettingsPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <PageHeader
        eyebrow="Settings"
        title="Company profile"
        description="Edit your public listing, company details, and branding."
      />

      <div className="flex gap-6">
        <SettingsSidebarNav active="company" />

        <div className="min-w-0 flex-1">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-900">🏢 Company profile</h2>
              <p className="mt-0.5 text-xs text-slate-500">Edit your public listing and company details</p>
            </div>
            <div className="p-6">
              <CompanySettingsForm company={company} />
              {company ? (
                <div className="mt-8">
                  <CollaborationDiscussionPanel
                    entityType="company"
                    entityId={company.id}
                    title="Company discussion"
                  />
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </FounderAppShell>
  );
}
