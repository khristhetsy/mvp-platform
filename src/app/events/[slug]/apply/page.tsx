import { notFound, redirect } from "next/navigation";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { getTranslations } from "next-intl/server";
import { MarketingFooter } from "@/components/MarketingFooter";
import { ApplyToPresentForm } from "@/components/events/ApplyToPresentForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { getEventBySlug } from "@/lib/icfo-events/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Apply to present — iCFO Events" };

export default async function ApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getTranslations("appPages");
  const supabase = await createServerSupabaseClient();
  const event = await getEventBySlug(supabase, slug).catch(() => null);
  if (!event || event.status === "draft" || event.status === "archived") notFound();

  const profile = await getCurrentUserProfile();
  if (!profile) redirect(`/auth/sign-in?next=/events/${slug}/apply`);

  const role = String(profile.role ?? "").toLowerCase();
  if (role !== "founder" && role !== "investor") {
    // Only founders/investors can apply to present.
    redirect(`/events/${slug}`);
  }

  return (
    <MarketingShell>
      <section className="mx-auto max-w-2xl px-4 py-14">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--indigo)]">{event.title}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--navy)]">{t("apply_to_present")}</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Tell us what you&apos;d like to present. Our team reviews every application against a curation
          rubric and will notify you of the decision.
        </p>
        <div className="mt-6">
          <ApplyToPresentForm
            eventId={event.id}
            slug={event.slug}
            sectors={event.sectors.map((s) => ({ slug: s.sectorSlug, label: s.label }))}
          />
        </div>
      </section>
      <MarketingFooter />
    </MarketingShell>
  );
}
