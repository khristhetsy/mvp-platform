import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEventById } from "@/lib/icfo-events/queries";
import { listEventLeads } from "@/lib/icfo-events/leads";
import { EventLeadsBoard } from "@/components/admin-events/EventLeadsBoard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Event leads" };

export default async function AdminEventLeadsPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("adminPages");
  const { profile } = await requirePermissionPage("manage_events");
  const { id } = await params;
  const admin = createServiceRoleClient();

  const event = await getEventById(admin, id).catch(() => null);
  if (!event) notFound();

  const leads = await listEventLeads(admin, id).catch(() => []);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("eventLeads")}
    >
      <div className="mx-auto max-w-4xl px-4 py-6">
        <Link href={`/admin/events/${id}`} className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--navy)]">
          <ArrowLeft className="h-4 w-4" /> Back to event
        </Link>
        <h1 className="mt-4 text-lg font-semibold text-[var(--navy)]">{event.title}</h1>
        <div className="mt-3">
          <EventLeadsBoard eventId={id} initialLeads={leads} />
        </div>
      </div>
    </AppShell>
  );
}
