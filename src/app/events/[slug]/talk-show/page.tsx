import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingFooter } from "@/components/MarketingFooter";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { getEventBySlug } from "@/lib/icfo-events/queries";
import { isBanned } from "@/lib/icfo-events/engagement";
import { pickTalkShowSession } from "@/lib/icfo-events/rooms";
import { sectorLabel } from "@/lib/icfo-events/sectors";
import { loadSessionQuestions, loadSessionChat, loadCallInQueue } from "@/lib/icfo-events/live-session";
import { loadSegments } from "@/lib/icfo-events/segments";
import { EventPresenceProvider } from "@/components/events/EventPresenceProvider";
import { EventVenueHeader } from "@/components/events/EventVenueHeader";
import { TalkShowCouch } from "@/components/events/TalkShowCouch";
import { SegmentRunOfShow } from "@/components/events/SegmentRunOfShow";
import { CallInBar } from "@/components/events/CallInBar";
import { GuestRoster } from "@/components/events/GuestRoster";
import { LiveSessionPanel } from "@/components/events/LiveSessionPanel";
import { LiveAnnouncementPopup } from "@/components/events/LiveAnnouncementPopup";
import { EventInfoDesk } from "@/components/events/EventInfoDesk";

export const dynamic = "force-dynamic";

const PRESENCE_ROOM = "Main Stage";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: "Talk Show — iCFO Events", alternates: { canonical: `/events/${slug}/talk-show` }, robots: { index: false } };
}

function fmtTime(iso: string | null): string {
  if (!iso) return "TBA";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function TalkShowPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const event = await getEventBySlug(supabase, slug).catch(() => null);
  if (!event || event.status === "draft" || event.status === "archived") notFound();

  const profile = await getCurrentUserProfile().catch(() => null);
  if (profile && (await isBanned(supabase, event.id, profile.id))) notFound();
  const me = profile ? { id: profile.id, name: profile.full_name ?? profile.email ?? "Attendee" } : null;
  const role = String(profile?.role ?? "").toLowerCase();
  const isStaffViewer = ["admin", "analyst"].includes(role);

  const stage = pickTalkShowSession(event.sessions);
  const isLive = stage?.status === "live";

  const [questions, chat, queue] =
    profile && stage && isLive
      ? await Promise.all([
          loadSessionQuestions(supabase, stage.id, profile.id).catch(() => []),
          loadSessionChat(supabase, stage.id).catch(() => []),
          loadCallInQueue(supabase, stage.id, profile.id, isStaffViewer).catch(() => []),
        ])
      : [[], [], []];

  const segments = stage ? await loadSegments(supabase, stage.id).catch(() => []) : [];

  // Run-of-show: the talk show's sibling sessions (same track if it has one).
  const siblings = event.sessions
    .filter((s) => s.status !== "draft" && (stage?.sectorSlug ? s.sectorSlug === stage.sectorSlug : true))
    .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? "") || a.position - b.position);
  const runOfShow = (siblings.length ? siblings : stage ? [stage] : []).map((s) => s.title).slice(0, 5);

  const subtitle = stage
    ? `Talk show${stage.sectorSlug ? ` · ${sectorLabel(stage.sectorSlug)} track` : ""}`
    : "No talk show scheduled yet";

  return (
    <MarketingShell>
      <section className="mx-auto max-w-5xl px-4 py-8">
        <Link href={`/events/${slug}/lobby`} className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--navy)]">
          <ArrowLeft className="h-4 w-4" /> Back to lobby
        </Link>

        <EventPresenceProvider eventId={event.id} slug={slug} room={PRESENCE_ROOM} me={me}>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
            <EventVenueHeader slug={slug} current="talkshow" tracksHref={`/events/${slug}/tracks`} />
            <div className="bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-semibold text-[var(--navy)]">{stage?.title ?? "Talk Show"}</h1>
                  <p className="mt-0.5 text-sm text-[var(--text-muted)]">{subtitle}</p>
                </div>
                {stage && !isLive && (
                  <span className="rounded-full bg-[var(--surface-sunken)] px-3 py-1 text-xs text-[var(--text-muted)]">
                    Starts {fmtTime(stage.startsAt)}
                  </span>
                )}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                <div>
                  {stage ? (
                    <TalkShowCouch
                      sessionId={stage.id}
                      presenceRoom={PRESENCE_ROOM}
                      segmentTitle={stage.abstract ? stage.abstract.slice(0, 70) : isLive ? "On air now" : "Up next"}
                      initialSegments={segments}
                      runOfShow={runOfShow}
                      isLive={Boolean(isLive)}
                    />
                  ) : (
                    <div className="rounded-2xl px-6 py-12 text-center text-sm" style={{ background: "#0a1422", color: "#8e9bb0" }}>
                      No talk show has been scheduled for this event yet.
                    </div>
                  )}
                  {isStaffViewer && stage && (
                    <>
                      <SegmentRunOfShow sessionId={stage.id} eventId={event.id} />
                      <GuestRoster sessionId={stage.id} eventId={event.id} />
                    </>
                  )}
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-[var(--navy)]">Call-in queue</h2>
                  {stage && isLive && profile && me ? (
                    <CallInBar
                      sessionId={stage.id}
                      eventId={event.id}
                      me={me}
                      isStaff={isStaffViewer}
                      roomUrl={stage.videoRef}
                      initialQueue={queue}
                    />
                  ) : (
                    <div className="mt-3 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                      {!isLive ? "The call-in line opens when the show goes on air." : "Sign in to raise your hand for a call-in."}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-[var(--text-muted)]">Host curates the couch — guests are admin-approved.</p>
                </div>
              </div>

              {stage && isLive && profile && me && (
                <div className="mt-4">
                  <h2 className="text-sm font-semibold text-[var(--navy)]">Live Q&amp;A &amp; chat</h2>
                  <LiveSessionPanel
                    sessionId={stage.id}
                    eventId={event.id}
                    me={me}
                    isStaff={isStaffViewer}
                    initialQuestions={questions}
                    initialChat={chat}
                  />
                </div>
              )}
            </div>
          </div>
          <LiveAnnouncementPopup />
          <EventInfoDesk slug={slug} />
        </EventPresenceProvider>
      </section>
      <MarketingFooter />
    </MarketingShell>
  );
}
