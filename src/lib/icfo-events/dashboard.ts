// Events dashboard: one read across events, registrations, speaker applications,
// sponsors and invitation campaigns. Pure builder + a loader that feeds it.
// Counts only. No attendee rows leave this file.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { listAllEvents } from "./queries";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export type DashEvent = { id: string; title: string; status: string; startsAt: string | null };
export type DashRegistration = { event_id: string; status: string };
export type DashApplication = { event_id: string; status: string };
export type DashCampaign = { id: string; status: string; event_ids: string[] };
export type DashInvitation = { campaign_id: string };

export interface EventsDashboardInput {
  events: DashEvent[];
  registrations: DashRegistration[];
  applications: DashApplication[];
  sponsorEventIds: string[];
  campaigns: DashCampaign[];
  invitations: DashInvitation[];
  now: Date;
}

export interface EventRow {
  id: string;
  title: string;
  status: string;
  startsAt: string | null;
  datePassed: boolean;
  registered: number;
  attended: number;
  noShow: number;
}

export interface AttentionItem {
  tone: "bad" | "warn" | "info";
  text: string;
}

export interface EventsDashboard {
  totals: {
    events: number;
    published: number;
    draftsPastDate: number;
    registrations: number;
    applicationsOpen: number;
    applicationsSubmitted: number;
    applicationsUnderReview: number;
    sponsors: number;
  };
  nextEvent: { id: string; title: string; daysAway: number } | null;
  rows: EventRow[];
  campaigns: { sending: number; scheduled: number; paused: number; done: number; draft: number };
  attention: AttentionItem[];
  invitedByEvent: Record<string, number>;
}

const LIVE_STATUSES = new Set(["published", "live"]);
const DAY = 86_400_000;

export function buildEventsDashboard(input: EventsDashboardInput): EventsDashboard {
  const { events, registrations, applications, sponsorEventIds, campaigns, invitations, now } = input;

  const regBy = new Map<string, { registered: number; attended: number; noShow: number }>();
  for (const r of registrations) {
    const cur = regBy.get(r.event_id) ?? { registered: 0, attended: 0, noShow: 0 };
    cur.registered += 1; // every registration counts as registered; attended and no_show are subsets
    if (r.status === "attended") cur.attended += 1;
    if (r.status === "no_show") cur.noShow += 1;
    regBy.set(r.event_id, cur);
  }

  const rows: EventRow[] = events.map((e) => {
    const c = regBy.get(e.id) ?? { registered: 0, attended: 0, noShow: 0 };
    const start = e.startsAt ? new Date(e.startsAt).getTime() : null;
    return {
      id: e.id,
      title: e.title,
      status: e.status,
      startsAt: e.startsAt,
      datePassed: start !== null && start < now.getTime(),
      registered: c.registered,
      attended: c.attended,
      noShow: c.noShow,
    };
  });

  const draftsPastDate = rows.filter((r) => r.status === "draft" && r.datePassed).length;

  const upcoming = rows
    .filter((r) => LIVE_STATUSES.has(r.status) && r.startsAt && !r.datePassed)
    .sort((a, b) => new Date(a.startsAt as string).getTime() - new Date(b.startsAt as string).getTime())[0];
  const nextEvent = upcoming
    ? {
        id: upcoming.id,
        title: upcoming.title,
        daysAway: Math.max(0, Math.ceil((new Date(upcoming.startsAt as string).getTime() - now.getTime()) / DAY)),
      }
    : null;

  const submitted = applications.filter((a) => a.status === "submitted").length;
  const underReview = applications.filter((a) => a.status === "under_review").length;

  const camp = { sending: 0, scheduled: 0, paused: 0, done: 0, draft: 0 };
  for (const c of campaigns) {
    if (c.status in camp) camp[c.status as keyof typeof camp] += 1;
  }

  const campaignEvents = new Map(campaigns.map((c) => [c.id, c.event_ids ?? []]));
  const invitedByEvent: Record<string, number> = {};
  for (const inv of invitations) {
    for (const eventId of campaignEvents.get(inv.campaign_id) ?? []) {
      invitedByEvent[eventId] = (invitedByEvent[eventId] ?? 0) + 1;
    }
  }

  const attention: AttentionItem[] = [];
  if (draftsPastDate > 0) {
    attention.push({
      tone: "bad",
      text: `${draftsPastDate} draft event${draftsPastDate === 1 ? " has" : "s have"} a start date in the past. Archive or reschedule.`,
    });
  }
  if (submitted > 0) {
    attention.push({ tone: "warn", text: `${submitted} speaker application${submitted === 1 ? "" : "s"} waiting on a first review.` });
  }
  if (camp.paused > 0) {
    attention.push({ tone: "warn", text: `${camp.paused} invitation campaign${camp.paused === 1 ? " is" : "s are"} paused.` });
  }
  if (nextEvent) {
    attention.push({ tone: "info", text: `${nextEvent.title} starts in ${nextEvent.daysAway} day${nextEvent.daysAway === 1 ? "" : "s"}.` });
  }

  return {
    totals: {
      events: events.length,
      published: events.filter((e) => LIVE_STATUSES.has(e.status)).length,
      draftsPastDate,
      registrations: registrations.length,
      applicationsOpen: submitted + underReview,
      applicationsSubmitted: submitted,
      applicationsUnderReview: underReview,
      sponsors: sponsorEventIds.length,
    },
    nextEvent,
    rows,
    campaigns: camp,
    attention,
    invitedByEvent,
  };
}

export async function loadEventsDashboard(supabase: SupabaseClient<Database>, now = new Date()): Promise<EventsDashboard> {
  const events = await listAllEvents(supabase);
  const db = raw(supabase);
  const [regs, apps, sponsors, camps, invs] = await Promise.all([
    db.from("registrations").select("event_id, status"),
    db.from("speaker_applications").select("event_id, status"),
    db.from("event_sponsors").select("event_id"),
    db.from("event_invitation_campaigns").select("id, status, event_ids"),
    db.from("event_invitations").select("campaign_id"),
  ]);
  return buildEventsDashboard({
    events: events.map((e) => ({ id: e.id, title: e.title, status: e.status, startsAt: e.startsAt })),
    registrations: (regs.data ?? []) as DashRegistration[],
    applications: (apps.data ?? []) as DashApplication[],
    sponsorEventIds: ((sponsors.data ?? []) as Array<{ event_id: string }>).map((s) => s.event_id),
    campaigns: (camps.data ?? []) as DashCampaign[],
    invitations: (invs.data ?? []) as DashInvitation[],
    now,
  });
}
