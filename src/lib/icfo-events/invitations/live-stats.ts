/**
 * Live numbers for event invitations: registrations by type, matches,
 * presentations, founder spotlights and talk show panelists.
 *
 * Every number is a count of real rows; nothing is estimated. Staff added
 * attendees are registrations like any other and count in every total.
 * Results are cached for five minutes per set of events, because the same
 * numbers are drawn on every email open and every registration page view.
 */
import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { matchableFromAnswers, sharedSectors } from "@/lib/icfo-events/matching-rule";
import type { StatCounts } from "@/lib/icfo-events/invitations/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; counts: StatCounts }>();

type RegRow = { event_id: string; attendee_type: string | null; answers: Record<string, unknown> | null };

/** Founder and investor pairs sharing at least one sector, within one event. Pure. */
export function countFounderInvestorMatches(rows: RegRow[]): number {
  const founders = rows.filter((r) => r.attendee_type === "founder").map((r) => matchableFromAnswers("founder", r.answers ?? {}));
  const investors = rows.filter((r) => r.attendee_type === "investor").map((r) => matchableFromAnswers("investor", r.answers ?? {}));
  let n = 0;
  for (const f of founders) for (const i of investors) if (sharedSectors(f, i).length > 0) n += 1;
  return n;
}

async function compute(eventIds: string[]): Promise<StatCounts> {
  const { data: regs } = await db()
    .from("registrations")
    .select("event_id, attendee_type, answers")
    .in("event_id", eventIds)
    .limit(20000);
  const rows = (regs ?? []) as RegRow[];

  const byEvent = new Map<string, RegRow[]>();
  for (const r of rows) (byEvent.get(r.event_id) ?? byEvent.set(r.event_id, []).get(r.event_id)!).push(r);
  let matches = 0;
  for (const list of byEvent.values()) matches += countFounderInvestorMatches(list);

  const { count: presentations } = await db()
    .from("event_presenters")
    .select("id", { count: "exact", head: true })
    .in("event_id", eventIds);

  const { data: talkShows } = await db()
    .from("sessions")
    .select("id")
    .in("event_id", eventIds)
    .eq("type", "talk_show");
  const talkShowIds = ((talkShows ?? []) as Array<{ id: string }>).map((s) => s.id);
  let panelists = 0;
  if (talkShowIds.length) {
    const { count } = await db()
      .from("session_guests")
      .select("id", { count: "exact", head: true })
      .in("session_id", talkShowIds)
      .ilike("role_label", "panelist");
    panelists = count ?? 0;
  }

  return {
    investors: rows.filter((r) => r.attendee_type === "investor").length,
    founders: rows.filter((r) => r.attendee_type === "founder").length,
    advisors: rows.filter((r) => r.attendee_type === "service").length,
    matches,
    presentations: presentations ?? 0,
    // Founder Spotlight is not built yet: no source, so it always shows its label.
    spotlights: null,
    panelists,
  };
}

/** Counts across the given events (summed), cached for five minutes. Never throws. */
export async function getLiveCounts(eventIds: string[]): Promise<StatCounts> {
  const ids = [...new Set(eventIds)].sort();
  const empty: StatCounts = { investors: null, founders: null, advisors: null, matches: null, presentations: null, spotlights: null, panelists: null };
  if (!ids.length) return empty;
  const key = ids.join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.counts;
  try {
    const counts = await compute(ids);
    cache.set(key, { at: Date.now(), counts });
    return counts;
  } catch {
    return hit?.counts ?? empty;
  }
}

/** Counts for each event separately, for the admin settings table. */
export async function getLiveCountsPerEvent(eventIds: string[]): Promise<Record<string, StatCounts>> {
  const out: Record<string, StatCounts> = {};
  for (const id of eventIds) out[id] = await getLiveCounts([id]);
  return out;
}
