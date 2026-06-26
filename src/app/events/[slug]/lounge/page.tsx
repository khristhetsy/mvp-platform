import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingFooter } from "@/components/MarketingFooter";
import { LoungeRoom } from "@/components/events/LoungeRoom";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { getEventBySlug } from "@/lib/icfo-events/queries";
import { loadLoungeTables } from "@/lib/icfo-events/lounge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Networking Lounge — iCFO Events", robots: { index: false } };

export default async function LoungePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const event = await getEventBySlug(supabase, slug).catch(() => null);
  if (!event || !["published", "live"].includes(event.status)) notFound();

  const profile = await getCurrentUserProfile();
  if (!profile) redirect(`/auth/sign-in?next=/events/${slug}/lounge`);

  const tables = await loadLoungeTables(supabase, event.id).catch(() => []);

  return (
    <MarketingShell>
      <section className="mx-auto max-w-5xl px-4 py-8">
        <Link href={`/events/${slug}`} className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--navy)]">
          <ArrowLeft className="h-4 w-4" /> Back to event
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--navy)]">Networking Lounge</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Join a topic table to chat with others here now. Education &amp; community — not an offer of securities.
        </p>

        <div className="mt-6">
          <LoungeRoom
            eventId={event.id}
            me={{ id: profile.id, name: profile.full_name ?? profile.email ?? "You" }}
            initialTables={tables}
          />
        </div>
      </section>
      <MarketingFooter />
    </MarketingShell>
  );
}
