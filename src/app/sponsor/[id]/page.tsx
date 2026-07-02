import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingFooter } from "@/components/MarketingFooter";
import { SponsorPortalClient } from "@/components/events/SponsorPortalClient";
import { RepOnlineToggle } from "@/components/events/RepOnlineToggle";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { getOwnedSponsor, listSponsorLeads, getSponsorBooth } from "@/lib/icfo-events/sponsors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sponsor portal — iCFO Events" };

export default async function SponsorPortalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("appPages");
  const profile = await getCurrentUserProfile();
  if (!profile) redirect(`/auth/sign-in?next=/sponsor/${id}`);

  const supabase = await createServerSupabaseClient();
  const sponsor = await getOwnedSponsor(supabase, id, profile.id).catch(() => null);
  if (!sponsor) notFound();

  const [leads, booth] = await Promise.all([
    listSponsorLeads(supabase, id).catch(() => []),
    getSponsorBooth(supabase, id).catch(() => null),
  ]);
  const events = booth?.events ?? [];

  return (
    <MarketingShell>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--indigo)]">{t("sponsor_portal")}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--navy)]">{sponsor.name}</h1>
        <Link href={`/events/sponsors/${id}`} className="mt-1 inline-block text-sm text-[var(--blue)] hover:underline">
          View public booth →
        </Link>
        <div className="mt-3">
          <RepOnlineToggle sponsorId={id} repName={sponsor.name} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
            <div className="text-2xl font-bold text-[var(--navy)]">{events.length}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-[var(--text-muted)]">Events partnered</div>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
            <div className="text-2xl font-bold text-[var(--navy)]">{leads.length}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-[var(--text-muted)]">Opt-in intros</div>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
            <div className="text-2xl font-bold capitalize text-[var(--navy)]">{sponsor.tier}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-[var(--text-muted)]">Tier</div>
          </div>
        </div>

        <SponsorPortalClient
          sponsorId={id}
          initialBlurb={sponsor.blurb}
          initialWebsite={sponsor.website}
          initialDownloads={sponsor.downloads}
          leads={leads}
        />
      </section>
      <MarketingFooter />
    </MarketingShell>
  );
}
