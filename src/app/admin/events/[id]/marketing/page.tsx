import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEventById } from "@/lib/icfo-events/queries";
import { loadMarketing } from "@/lib/icfo-events/marketing";
import { isClaudeConfigured } from "@/lib/claude";
import { MarketingHub } from "@/components/admin-events/MarketingHub";

export const dynamic = "force-dynamic";
export const metadata = { title: "Marketing Hub" };

export default async function AdminEventMarketingPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("adminPages");
  const { profile } = await requirePermissionPage("manage_events");
  const { id } = await params;
  const admin = createServiceRoleClient();

  const event = await getEventById(admin, id).catch(() => null);
  if (!event) notFound();

  const marketing = await loadMarketing(admin, id).catch(() => null);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("marketingHub")}
    >
      <div className="mx-auto max-w-4xl px-4 py-6">
        <Link href={`/admin/events/${id}`} className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--navy)]">
          <ArrowLeft className="h-4 w-4" /> Back to event
        </Link>
        <div className="mt-4">
          <MarketingHub
            eventId={id}
            eventTitle={event.title}
            initial={marketing ?? {
              seoTitle: "",
              seoDescription: "",
              seoKeywords: "",
              brochure: { headline: "", subhead: "", body: "", highlights: [], cta: "" },
              email: { subject: "", preheader: "", body: "" },
              social: { linkedin: "", facebook: "", instagram: "" },
              updatedAt: null,
            }}
            claudeConfigured={isClaudeConfigured()}
          />
        </div>
      </div>
    </AppShell>
  );
}
