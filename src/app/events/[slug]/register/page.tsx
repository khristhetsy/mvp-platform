import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingFooter } from "@/components/MarketingFooter";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { getEventBySlug } from "@/lib/icfo-events/queries";
import { EventRegistrationForm } from "@/components/events/EventRegistrationForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Register — iCFO Events", robots: { index: false } };

export default async function RegisterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getTranslations("appPages");
  const supabase = await createServerSupabaseClient();
  const event = await getEventBySlug(supabase, slug).catch(() => null);
  if (!event || event.status === "draft" || event.status === "archived") notFound();

  const profile = await getCurrentUserProfile();
  if (!profile) redirect(`/auth/sign-in?next=/events/${slug}/register`);

  return (
    <MarketingShell>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <Link href={`/events/${slug}`} className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--navy)]">
          <ArrowLeft className="h-4 w-4" /> Back to event
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--navy)]">{event.title}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t("free_registration_a_few_quick_questions_so_we")}</p>

        <div className="mt-6">
          <EventRegistrationForm eventId={event.id} slug={slug} />
        </div>
      </section>
      <MarketingFooter />
    </MarketingShell>
  );
}
