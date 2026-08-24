// Event Email — merge-field contract (build spec §5). Single source of truth for
// turning a published event into email/brochure merge data. Zod-validated so
// preview and send never drift. Shared with the future Brochure renderer (§12).

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { EventWithDetail, EventSession } from "@/lib/icfo-events/types";
import { getEventById } from "@/lib/icfo-events/queries";
import { bannerPublicUrl } from "@/lib/icfo-events/banner";
import { listEventSponsors } from "@/lib/icfo-events/sponsors";
import { listEventPresenters } from "@/lib/icfo-events/applications";
import { publishedBookletUrl } from "@/lib/event-hub/brochure/editions";

export const ORGANIZER_LINE = "iCFO Capital Global, Inc. · (619) 956-9114 · info@myicfos.com";
export const EVENT_BADGE = "iCFO Capital · Ecosystem Showcase";

/** Session accent by type — matches the approved template (§5). */
export const SESSION_ACCENT: Record<string, string> = {
  keynote: "#0D9488",
  panel: "#0D9488",
  workshop: "#0D9488",
  founder_showcase: "#534AB7",
  talk_show: "#0c2340",
};

export type EventEmailType = "invite" | "reminder" | "day_of" | "booklet";

export const eventMergeSchema = z.object({
  eventId: z.string(),
  title: z.string(),
  badge: z.string(),
  tagline: z.string(),
  dateLabel: z.string(),
  timeRange: z.string(),
  formatLine: z.string(),
  bannerUrl: z.string().nullable(),
  registerUrl: z.string(),
  lobbyUrl: z.string(),
  /** The event's live published booklet URL, when one exists. */
  bookletUrl: z.string().nullable().default(null),
  sessions: z.array(
    z.object({ type: z.string(), title: z.string(), abstract: z.string(), accent: z.string() }),
  ),
  sponsorLockup: z.string().nullable(),
  organizerLine: z.string(),
  // ── brochure-only additions (email ignores these) ──
  presenters: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      company: z.string(),
      headshotUrl: z.string().nullable(),
      initials: z.string(),
      bio: z.string().default(""),
      companySummary: z.string().default(""),
    }),
  ),
  sponsorTiers: z.object({
    presenting: z.array(z.object({ name: z.string(), logoUrl: z.string().nullable() })),
    track: z.array(z.object({ name: z.string(), logoUrl: z.string().nullable() })),
    community: z.array(z.object({ name: z.string(), logoUrl: z.string().nullable() })),
  }),
});
export type EventMergeData = z.infer<typeof eventMergeSchema>;

const initialsOf = (n: string) => n.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : s);

function fmt(iso: string | null, tz: string | null, opts: Intl.DateTimeFormatOptions): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz || undefined }).format(new Date(iso));
  } catch {
    return "";
  }
}

/** Pure mapper: EventWithDetail (+ resolved extras) → EventMergeData. Testable. */
export function buildEventMergeData(
  event: EventWithDetail,
  extras: {
    baseUrl: string;
    campaignId?: string;
    bannerUrl: string | null;
    presentingSponsors?: string[];
    presenters?: EventMergeData["presenters"];
    sponsorTiers?: EventMergeData["sponsorTiers"];
    bookletUrl?: string | null;
  },
): EventMergeData {
  const { baseUrl, campaignId = "preview", bannerUrl, presentingSponsors = [] } = extras;
  const emptyTiers = { presenting: [], track: [], community: [] };
  const tz = event.timezone;
  const dateLabel = fmt(event.startsAt, tz, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const start = fmt(event.startsAt, tz, { hour: "numeric", minute: "2-digit" });
  const end = fmt(event.endsAt, tz, { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const timeRange = start && end ? `${start} – ${end}` : start || "";
  const formatLine = `${cap(event.format)} · ${event.visibility === "public" ? "Free registration" : "Members only"}`;
  const utm = `utm_source=email&utm_campaign=${encodeURIComponent(campaignId)}`;
  const sessions = (event.sessions ?? [])
    .filter((s: EventSession) => s.status !== "draft")
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      type: s.type,
      title: s.title,
      abstract: s.abstract ?? "",
      accent: SESSION_ACCENT[s.type] ?? "#0D9488",
    }));

  return {
    eventId: event.id,
    title: event.title,
    badge: event.bannerTitle || EVENT_BADGE,
    tagline: event.summary ?? "",
    dateLabel,
    timeRange,
    formatLine,
    bannerUrl,
    registerUrl: `${baseUrl}/events/${event.slug}?${utm}`,
    lobbyUrl: `${baseUrl}/events/${event.slug}/lobby?${utm}`,
    bookletUrl: extras.bookletUrl ?? null,
    sessions,
    sponsorLockup: presentingSponsors.length ? `Presented with ${presentingSponsors.join(", ")}` : null,
    organizerLine: ORGANIZER_LINE,
    presenters: extras.presenters ?? [],
    sponsorTiers: extras.sponsorTiers ?? emptyTiers,
  };
}

/** Server loader: fetch the event + banner + presenting sponsors and build merge data. */
export async function loadEventMergeData(
  supabase: SupabaseClient<Database>,
  eventId: string,
  opts: { baseUrl: string; campaignId?: string },
): Promise<EventMergeData | null> {
  const event = await getEventById(supabase, eventId).catch(() => null);
  if (!event) return null;
  const bannerUrl = bannerPublicUrl(supabase, event.coverPath);
  const [sponsors, presenterRows] = await Promise.all([
    listEventSponsors(supabase, eventId).catch(() => []),
    listEventPresenters(supabase, eventId).catch(() => []),
  ]);
  const bookletUrl = await publishedBookletUrl(supabase, eventId, opts.baseUrl).catch(() => null);
  const presentingSponsors = sponsors.filter((s) => s.placement === "presenting").map((s) => s.name);
  const tierOf = (p: string) => (p === "presenting" ? "presenting" : p === "track" ? "track" : "community");
  const sponsorTiers: EventMergeData["sponsorTiers"] = { presenting: [], track: [], community: [] };
  for (const s of sponsors) sponsorTiers[tierOf(s.placement)].push({ name: s.name, logoUrl: s.logoUrl ?? null });
  const presenters = presenterRows
    .sort((a, b) => a.position - b.position)
    .map((p) => ({
      name: p.displayName,
      role: p.roleLabel ?? "",
      company: p.headline ?? "",
      headshotUrl: null as string | null,
      initials: initialsOf(p.displayName),
      bio: p.bio ?? "",
      companySummary: p.companySummary ?? "",
    }));
  return buildEventMergeData(event, { baseUrl: opts.baseUrl, campaignId: opts.campaignId, bannerUrl, presentingSponsors, presenters, sponsorTiers, bookletUrl });
}
