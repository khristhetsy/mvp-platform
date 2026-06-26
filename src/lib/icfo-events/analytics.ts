// Staff analytics: aggregate KPIs per event. A few column-only reads tallied in
// memory — cheap regardless of event count, and never exposes raw attendee data.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { listAllEvents } from "./queries";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export interface EventAnalyticsRow {
  eventId: string;
  title: string;
  status: string;
  registrations: number;
  applications: number;
  approved: number;
  sessions: number;
  sponsors: number;
  networkingOptIns: number;
}

export interface EventAnalyticsTotals {
  events: number;
  registrations: number;
  applications: number;
  approved: number;
  acceptanceRate: number; // 0–1
}

function tally(rows: Array<Record<string, unknown>>, key = "event_id"): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[key]);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export async function getEventAnalytics(
  supabase: SupabaseClient<Database>,
): Promise<{ rows: EventAnalyticsRow[]; totals: EventAnalyticsTotals }> {
  const events = await listAllEvents(supabase);

  const [regs, apps, sessions, sponsors, optins] = await Promise.all([
    raw(supabase).from("registrations").select("event_id"),
    raw(supabase).from("speaker_applications").select("event_id, status"),
    raw(supabase).from("sessions").select("event_id"),
    raw(supabase).from("event_sponsors").select("event_id"),
    raw(supabase).from("networking_optins").select("event_id, opted_in"),
  ]);

  const regMap = tally((regs.data ?? []) as Array<Record<string, unknown>>);
  const appRows = (apps.data ?? []) as Array<Record<string, unknown>>;
  const appMap = tally(appRows);
  const approvedMap = tally(appRows.filter((r) => r.status === "approved"));
  const sessionMap = tally((sessions.data ?? []) as Array<Record<string, unknown>>);
  const sponsorMap = tally((sponsors.data ?? []) as Array<Record<string, unknown>>);
  const optinRows = (optins.data ?? []) as Array<Record<string, unknown>>;
  const optinMap = tally(optinRows.filter((r) => r.opted_in === true));

  const rows: EventAnalyticsRow[] = events.map((e) => ({
    eventId: e.id,
    title: e.title,
    status: e.status,
    registrations: regMap.get(e.id) ?? 0,
    applications: appMap.get(e.id) ?? 0,
    approved: approvedMap.get(e.id) ?? 0,
    sessions: sessionMap.get(e.id) ?? 0,
    sponsors: sponsorMap.get(e.id) ?? 0,
    networkingOptIns: optinMap.get(e.id) ?? 0,
  }));

  const totalApplications = rows.reduce((s, r) => s + r.applications, 0);
  const totalApproved = rows.reduce((s, r) => s + r.approved, 0);
  const totals: EventAnalyticsTotals = {
    events: events.length,
    registrations: rows.reduce((s, r) => s + r.registrations, 0),
    applications: totalApplications,
    approved: totalApproved,
    acceptanceRate: totalApplications > 0 ? totalApproved / totalApplications : 0,
  };

  return { rows, totals };
}
