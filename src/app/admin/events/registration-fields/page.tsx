import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import {
  answerCounts,
  listFieldSetVersions,
  loadRegistrationFieldSet,
} from "@/lib/icfo-events/registration-field-sets-server";
import { sharedOptions } from "@/lib/icfo-events/registration-field-sets";
import { RegistrationFieldsEditor } from "@/components/admin-events/RegistrationFieldsEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registration fields" };

export default async function RegistrationFieldsPage() {
  const { profile } = await requirePermissionPage("manage_events");

  const [set, usage, versions] = await Promise.all([
    loadRegistrationFieldSet(),
    answerCounts(),
    listFieldSetVersions(),
  ]);

  return (
    <AppShell profileName={profile.full_name ?? profile.email ?? "Admin"}>
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Event Hub"
          title="Registration fields"
          description="The questions asked at registration, for every event. Changes apply to the public registration form and the admin Register-a-guest form together."
        />
        <div className="mt-6">
          <RegistrationFieldsEditor
            initialSet={set}
            usage={usage}
            linked={{ sectors: sharedOptions("sectors"), countries: sharedOptions("countries") }}
            versions={versions.map((v) => ({
              id: v.id, version: v.version, isActive: v.isActive,
              reason: v.reason, createdAt: v.createdAt, createdByName: v.createdByName,
            }))}
          />
        </div>
      </WorkspacePageContainer>
    </AppShell>
  );
}
