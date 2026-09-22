import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listAllRegistrations } from "@/lib/icfo-events/registrations";
import { listAllEvents } from "@/lib/icfo-events/queries";
import {
  answerCounts,
  listFieldSetVersions,
  loadRegistrationFieldSet,
} from "@/lib/icfo-events/registration-field-sets-server";
import { sharedOptionList } from "@/lib/icfo-events/registration-field-sets";
import { RegistrationFieldsEditor } from "@/components/admin-events/RegistrationFieldsEditor";
import { AllRegistrationsTable, type AllRegRow } from "@/components/admin-events/AllRegistrationsTable";
import { LISTED_PUBLICLY_KEY } from "@/lib/icfo-events/registration-fields";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registration" };

const TABS = [
  { key: "list", label: "Registrations" },
  { key: "fields", label: "Fields" },
] as const;

/**
 * Registration — who has registered, and what they were asked.
 *
 * Two tabs rather than two menu items: the questions and the answers are the
 * same subject, and the field editor was previously a top-level entry sitting
 * beside things it has nothing to do with.
 */
export default async function RegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { profile } = await requirePermissionPage("manage_events");
  const { tab } = await searchParams;
  const active = tab === "fields" ? "fields" : "list";
  const admin = createServiceRoleClient();

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Registration">
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Event Hub"
          title="Registration"
          description="Everyone who has registered, and the questions they were asked."
        />

        <div className="mt-5 flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-lg bg-slate-100 p-0.5">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "list" ? "/admin/events/registrations" : "/admin/events/registrations?tab=fields"}
              className={`whitespace-nowrap rounded-md px-3.5 py-1.5 text-[12.5px] font-medium ${
                active === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="mt-5">
          {active === "list" ? <RegistrationsTab /> : <FieldsTab />}
        </div>
      </WorkspacePageContainer>
    </AppShell>
  );

  async function RegistrationsTab() {
    const [rows, events] = await Promise.all([
      listAllRegistrations(admin).catch(() => []),
      listAllEvents(admin).catch(() => []),
    ]);
    const mapped: AllRegRow[] = rows.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      eventTitle: r.eventTitle,
      attendeeType: r.attendeeType,
      contactName: r.contactName,
      contactEmail: r.contactEmail,
      company: r.company,
      createdAt: r.createdAt,
      // Absent means private: the tick postdates most of these registrations,
      // and nobody is listed by default.
      listedPublicly: r.answers[LISTED_PUBLICLY_KEY] === true,
    }));
    return (
      <AllRegistrationsTable
        rows={mapped}
        events={events.map((e) => ({ id: e.id, title: e.title }))}
      />
    );
  }

  async function FieldsTab() {
    const [set, usage, versions] = await Promise.all([
      loadRegistrationFieldSet(),
      answerCounts(),
      listFieldSetVersions(),
    ]);
    return (
      <RegistrationFieldsEditor
        initialSet={set}
        usage={usage}
        linked={{ sectors: sharedOptionList("sectors"), countries: sharedOptionList("countries") }}
        versions={versions.map((v) => ({
          id: v.id, version: v.version, isActive: v.isActive,
          reason: v.reason, createdAt: v.createdAt, createdByName: v.createdByName,
        }))}
      />
    );
  }
}
