import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingFooter } from "@/components/MarketingFooter";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { getEventBySlug } from "@/lib/icfo-events/queries";
import { isBanned } from "@/lib/icfo-events/engagement";
import { pickMainStageSession } from "@/lib/icfo-events/rooms";
import { loadSessionQuestions, loadSessionChat } from "@/lib/icfo-events/live-session";
import { EventPresenceProvider } from "@/components/events/EventPresenceProvider";
import { EventVenueHeader } from "@/components/events/EventVenueHeader";
import { LiveStagePlayer } from "@/components/events/LiveStagePlayer";
import { LiveViewerCount } from "@/components/events/LiveViewerCount";
import { LiveSessionPanel } from "@/components/events/LiveSessionPanel";
import { LiveAnnouncementPopup } from "@/components/events/LiveAnnouncementPopup";
import { EventInfoDesk } from "@/components/events/EventInfoDesk";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: "Main Stage — iCFO Events", alternates: { canonical: `/events/${slug}/stage` }, robots: { index: false } };
}

function fmtTime(iso: string | null): string {
  if (!iso) return "TBA";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function MainStagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getTranslations("appPages");
  const supabase = await createServerSupabaseClient();
  const event = await getEventBySlug(supabase, slug).catch(() => null);
  if (!event || event.status === "draft" || event.status === "archived") notFound();

  const profile = await getCurrentUserProfile().catch(() => null);
  if (profile && (await isBanned(supabase, event.id, profile.id))) notFound();
  const me = profile ? { id: profile.id, name: profile.full_name ?? profile.email ?? "Attendee" } : null;
  const role = String(profile?.role ?? "").toLowerCase();
  const isStaffViewer = ["admin", "analyst"].includes(role);

  const stage = pickMainStageSession(event.sessions);
  const isLive = stage?.status === "live";

  const [questions, chat] =
    profile && stage && isLive
      ? await Promise.all([
          loadSessionQuestions(supabase, stage.id, profile.id).catch(() => []),
          loadSessionChat(supabase, stage.id).catch(() => []),
        ])
      : [[], []];

  const upNext = event.sessions
    .filter((s) => s.type !== "talk_show" && s.status === "scheduled" && s.id !== stage?.id)
    .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""))
    .slice(0, 4);

  const tracksHref = `/events/${slug}/tracks`;

  return (
    <MarketingShell>
      <section className="mx-auto max-w-5xl px-4 py-8">
        <Link href={`/events/${slug}/lobby`} className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--navy)]">
          <ArrowLeft className="h-4 w-4" /> Back to lobby
        </Link>

        <EventPresenceProvider eventId={event.id} slug={slug} room="Main Stage" me={me}>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
            <EventVenueHeader slug={slug} current="sessions" tracksHref={tracksHref} />
            <div className="bg-white p-4">
              <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
                <div>
                  <LiveStagePlayer
                    session={stage}
                    badge="LIVE · Main Stage"
                    viewerSlot={<LiveViewerCount room="Main Stage" />}
                    caption={isLive ? "Headline live session" : stage ? `Next: ${fmtTime(stage.startsAt)}` : undefined}
                  />
                  {upNext.length > 0 && (
                    <div className="mt-4">
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("up_next_on_the_main_stage")}</h2>
                      <ul className="mt-2 divide-y divide-[var(--border-subtle)] overflow-hidden rounded-xl border border-[var(--border-subtle)]">
                        {upNext.map((s) => (
                          <li key={s.id} className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-sm font-medium text-[var(--navy)]">{s.title}</span>
                            <span className="text-xs text-[var(--text-muted)]">{fmtTime(s.startsAt)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-[var(--navy)]">{t("live_q_a")}</h2>
                  {stage && isLive && profile && me ? (
                    <LiveSessionPanel
                      sessionId={stage.id}
                      eventId={event.id}
                      me={me}
                      isStaff={isStaffViewer}
                      initialQuestions={questions}
                      initialChat={chat}
                    />
                  ) : (
                    <div className="mt-3 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                      {!isLive
                        ? "Q&A opens when the main stage goes live."
                        : "Sign in to ask questions and join the chat."}
                    </div>
                  )}
                </div>
              </div>
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
