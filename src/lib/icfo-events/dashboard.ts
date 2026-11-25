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
export type DashRegistration = { event_id: string; status: string; attendee_id?: string; created_at?: string };
export type DashApplication = { event_id: string; status: string; applicant_id?: string; topic?: string; created_at?: string };
export type DashCampaign = { id: string; status: string; event_ids: string[]; name?: string };
export type DashSponsor = { event_id: string; sponsor_id: string };
export type DashInvitation = { campaign_id: string };

export interface EventsDashboardInput {
  events: DashEvent[];
  registrations: DashRegistration[];
  applications: DashApplication[];
  sponsors: DashSponsor[];
  campaigns: DashCampaign[];
  invitations: DashInvitation[];
  /** profile id to display name, for the records shown in popups. */
  names?: Record<string, string>;
  /** sponsor id to name. */
  sponsorNames?: Record<string, string>;
  now: Date;
}

/** One record behind a number: a label, a second line, and the page it opens. */
export interface DashRecord {
  label: string;
  sub?: string;
  value: string;
  href: string;
}

export interface RecordList {
  total: number;
  records: DashRecord[];
}

export const RECORD_LIMIT = 8;

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
  kind: "drafts" | "applications" | "paused" | "next";
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
  records: {
    events: RecordList;
    draftsPastDate: RecordList;
    /** keyed by event id, or "all". */
    registrations: Record<string, RecordList>;
    attended: Record<string, RecordList>;
    noShow: Record<string, RecordList>;
    applicationsOpen: RecordList;
    sponsors: RecordList;
    /** keyed by campaign status, plus "event:<id>" for the campaigns that invite to one event. */
    campaigns: Record<string, RecordList>;
  };
}

const LIVE_STATUSES = new Set(["published", "live"]);
const DAY = 86_400_000;

export function buildEventsDashboard(input: EventsDashboardInput): EventsDashboard {
  const { events, registrations, applications, sponsors, campaigns, invitations, now } = input;
  const names = input.names ?? {};
  const sponsorNames = input.sponsorNames ?? {};

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
      kind: "drafts",
      tone: "bad",
      text: `${draftsPastDate} draft event${draftsPastDate === 1 ? " has" : "s have"} a start date in the past. Archive or reschedule.`,
    });
  }
  if (submitted > 0) {
    attention.push({ kind: "applications", tone: "warn", text: `${submitted} speaker application${submitted === 1 ? "" : "s"} waiting on a first review.` });
  }
  if (camp.paused > 0) {
    attention.push({ kind: "paused", tone: "warn", text: `${camp.paused} invitation campaign${camp.paused === 1 ? " is" : "s are"} paused.` });
  }
  if (nextEvent) {
    attention.push({ kind: "next", tone: "info", text: `${nextEvent.title} starts in ${nextEvent.daysAway} day${nextEvent.daysAway === 1 ? "" : "s"}.` });
  }


  const list = (items: DashRecord[]): RecordList => ({ total: items.length, records: items.slice(0, RECORD_LIMIT) });
  const newest = <T extends { created_at?: string }>(a: T[]) =>
    [...a].sort((x, y) => (y.created_at ?? "").localeCompare(x.created_at ?? ""));
  const day = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
  const titleOf = new Map(events.map((e) => [e.id, e.title]));

  const regRecord = (r: DashRegistration): DashRecord => ({
    label: (r.attendee_id && names[r.attendee_id]) || "Registrant",
    sub: [titleOf.get(r.event_id), r.created_at ? `registered ${day(r.created_at)}` : null].filter(Boolean).join(", "),
    value: r.status,
    href: `/admin/events/${r.event_id}/registrations`,
  });
  const regRecords = (rows: DashRegistration[], status?: string) =>
    list(newest(rows.filter((r) => !status || r.status === status)).map(regRecord));
  const registrationsRec: Record<string, RecordList> = { all: regRecords(registrations) };
  const attendedRec: Record<string, RecordList> = { all: regRecords(registrations, "attended") };
  const noShowRec: Record<string, RecordList> = { all: regRecords(registrations, "no_show") };
  for (const e of events) {
    const own = registrations.filter((r) => r.event_id === e.id);
    registrationsRec[e.id] = regRecords(own);
    attendedRec[e.id] = regRecords(own, "attended");
    noShowRec[e.id] = regRecords(own, "no_show");
  }

  const eventRecord = (r: EventRow): DashRecord => ({
    label: r.title,
    sub: `${r.startsAt ? day(r.startsAt) : "No date"}${r.datePassed ? ", date passed" : ""}`,
    value: r.status,
    href: `/admin/events/${r.id}`,
  });

  const campaignRecord = (c: DashCampaign): DashRecord => ({
    label: c.name || "Untitled campaign",
    sub: `${invitations.filter((i) => i.campaign_id === c.id).length} invited`,
    value: c.status,
    href: "/admin/events/invitations",
  });
  const campaignsRec: Record<string, RecordList> = {};
  for (const status of ["sending", "scheduled", "paused", "done", "draft"]) {
    campaignsRec[status] = list(campaigns.filter((c) => c.status === status).map(campaignRecord));
  }
  for (const e of events) {
    campaignsRec[`event:${e.id}`] = list(campaigns.filter((c) => (c.event_ids ?? []).includes(e.id)).map(campaignRecord));
  }

  const openApps = newest(applications.filter((a) => a.status === "submitted" || a.status === "under_review"));
  const records: EventsDashboard["records"] = {
    events: list(rows.map(eventRecord)),
    draftsPastDate: list(rows.filter((r) => r.status === "draft" && r.datePassed).map(eventRecord)),
    registrations: registrationsRec,
    attended: attendedRec,
    noShow: noShowRec,
    applicationsOpen: list(
      openApps.map((a) => ({
        label: a.topic || "Application",
        sub: [a.applicant_id && names[a.applicant_id], titleOf.get(a.event_id)].filter(Boolean).join(", "),
        value: a.status === "submitted" ? "Submitted" : "Under review",
        href: "/admin/events/applications",
      })),
    ),
    sponsors: list(
      sponsors.map((sp) => ({
        label: sponsorNames[sp.sponsor_id] || "Sponsor",
        sub: titleOf.get(sp.event_id),
        value: "Listed",
        href: "/admin/events/sponsors",
      })),
    ),
    campaigns: campaignsRec,
  };

  return {
    totals: {
      events: events.length,
      published: events.filter((e) => LIVE_STATUSES.has(e.status)).length,
      draftsPastDate,
      registrations: registrations.length,
      applicationsOpen: submitted + underReview,
      applicationsSubmitted: submitted,
      applicationsUnderReview: underReview,
      sponsors: sponsors.length,
    },
    nextEvent,
    rows,
    campaigns: camp,
    attention,
    invitedByEvent,
    records,
  };
}

export async function loadEventsDashboard(supabase: SupabaseClient<Database>, now = new Date()): Promise<EventsDashboard> {
  const events = await listAllEvents(supabase);
  const db = raw(supabase);
  const [regs, apps, sponsors, camps, invs] = await Promise.all([
    db.from("registrations").select("event_id, status, attendee_id, created_at"),
    db.from("speaker_applications").select("event_id, status, applicant_id, topic, created_at"),
    db.from("event_sponsors").select("event_id, sponsor_id"),
    db.from("event_invitation_campaigns").select("id, name, status, event_ids"),
    db.from("event_invitations").select("campaign_id"),
  ]);
  const registrations = (regs.data ?? []) as DashRegistration[];
  const applications = (apps.data ?? []) as DashApplication[];
  const sponsorRows = (sponsors.data ?? []) as DashSponsor[];

  // Names only for the records a popup can show: the newest few of each list.
  const newestIds = (rows: Array<{ created_at?: string }>, key: "attendee_id" | "applicant_id") =>
    [...rows]
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .slice(0, 60)
      .map((r) => (r as Record<string, unknown>)[key] as string | undefined)
      .filter((v): v is string => Boolean(v));
  const profileIds = [...new Set([...newestIds(registrations, "attendee_id"), ...newestIds(applications, "applicant_id")])];
  const sponsorIds = [...new Set(sponsorRows.map((s) => s.sponsor_id))];
  const [profs, spons] = await Promise.all([
    profileIds.length ? db.from("profiles").select("id, full_name, email").in("id", profileIds) : Promise.resolve({ data: [] }),
    sponsorIds.length ? db.from("sponsors").select("id, name").in("id", sponsorIds) : Promise.resolve({ data: [] }),
  ]);
  const names: Record<string, string> = {};
  for (const p of (profs.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
    names[p.id] = p.full_name || p.email || "Registrant";
  }
  const sponsorNames: Record<string, string> = {};
  for (const sp of (spons.data ?? []) as Array<{ id: string; name: string }>) sponsorNames[sp.id] = sp.name;

  return buildEventsDashboard({
    events: events.map((e) => ({ id: e.id, title: e.title, status: e.status, startsAt: e.startsAt })),
    registrations,
    applications,
    sponsors: sponsorRows,
    campaigns: (camps.data ?? []) as DashCampaign[],
    invitations: (invs.data ?? []) as DashInvitation[],
    names,
    sponsorNames,
    now,
  });
}
