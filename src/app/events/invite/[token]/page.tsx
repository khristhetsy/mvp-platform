import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingFooter } from "@/components/MarketingFooter";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { EventRegistrationForm } from "@/components/events/EventRegistrationForm";
import { loadRegistrationFieldSet } from "@/lib/icfo-events/registration-field-sets-server";
import { VocabularyProvider } from "@/lib/vocabulary/provider";
import { loadVocabularies } from "@/lib/vocabulary/store";
import { invitationFromToken } from "@/lib/icfo-events/invitations/store";
import { loadPrefill, registeredEventIds } from "@/lib/icfo-events/invitations/person";
import { getLiveCounts } from "@/lib/icfo-events/invitations/live-stats";
import { emailEvent, loadEvents, statEventIds, upcomingEvents } from "@/lib/icfo-events/invitations/runner";
import { ATTENDEE_TYPE_FOR_ROLE, STAT_ORDER, statTiles } from "@/lib/icfo-events/invitations/types";
import { seriesName } from "@/lib/icfo-events/invitations/emails";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your invitation — iCFO Events", robots: { index: false } };

/**
 * Where an invitation email's button lands: the existing registration form,
 * filled in with what we know, with every event in the campaign to choose from.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw);
  const inv = await invitationFromToken(token);
  if (!inv) notFound();

  const events = upcomingEvents(await loadEvents(inv.campaign.eventIds));
  // The link stops working the day after the last event.
  if (!events.length) notFound();

  const profile = await getCurrentUserProfile().catch(() => null);
  // Signed in as someone else: their own details, not the invitee's.
  const who = profile ? { email: profile.email ?? null, profileId: profile.id } : { email: inv.email, profileId: null };
  const [known, already, counts] = await Promise.all([
    loadPrefill(who),
    registeredEventIds(events.map((e) => e.id), who),
    getLiveCounts(statEventIds(inv.campaign, events)),
  ]);
  const role = ATTENDEE_TYPE_FOR_ROLE[inv.role];
  const answers = { ...(inv.firstName && !known.answers.name ? { name: inv.firstName } : {}), ...(inv.company && !known.answers.company ? { company: inv.company } : {}), email: who.email ?? inv.email, ...known.answers };
  const first = events[0];

  return (
    <MarketingShell>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--navy)]">You&apos;re invited to the {seriesName(events.map((e) => e.title))}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Choose your events and confirm your details. Registration is free.</p>
        <div className="mt-6">
          <VocabularyProvider value={await loadVocabularies()}>
            <EventRegistrationForm
              eventId={first.id}
              slug={first.slug}
              fieldSet={await loadRegistrationFieldSet()}
              signedIn={Boolean(profile)}
              prefill={{ answers, firstName: known.firstName ?? inv.firstName, role }}
              invite={{ token, events: events.map((e) => ({ id: e.id, title: e.title, dateLabel: emailEvent(e).dateLabel, already: already.includes(e.id) })) }}
              liveTiles={statTiles(counts, inv.campaign.stats, STAT_ORDER[inv.role])}
            />
          </VocabularyProvider>
        </div>
      </section>
      <MarketingFooter />
    </MarketingShell>
  );
}
