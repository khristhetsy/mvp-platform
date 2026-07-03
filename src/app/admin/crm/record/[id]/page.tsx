import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { loadContactRecord } from "@/lib/crm/load-console";
import { getAnnotation } from "@/lib/crm-connectors/annotations";
import { RecordView } from "@/components/crm/RecordView";

export const dynamic = "force-dynamic";

export default async function AdminCrmRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const externalId = decodeURIComponent(id).replace(/^mirror:/, "");
  const profile = await requireRole(["admin", "analyst"]);
  const [record, annotation] = await Promise.all([
    loadContactRecord(externalId).catch(() => null),
    getAnnotation(externalId).catch(() => null),
  ]);
  if (!record) notFound();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <div className="mx-auto max-w-4xl px-4 py-6">
        <RecordView record={record} annotation={annotation} />
      </div>
    </AppShell>
  );
}
