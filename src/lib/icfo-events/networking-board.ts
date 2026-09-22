/**
 * Networking Matching — the staff view of who matched with whom.
 *
 * Registration is the qualifier. Someone who registered as an investor or a
 * founder is in the pool, whether or not they ever found the networking opt-in
 * — that toggle gates what an attendee is *shown* in the app, and using it here
 * meant a 106-person event produced one match.
 *
 * Matches are not stored: they are recomputed from the registration answers on
 * every load, the same shared-sector rule the attendee suggestions use.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function raw(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

type Row = Record<string, unknown>;

export type Side = {
  /** Null for a guest registered without an account. */
  profileId: string | null;
  registrationId: string;
  name: string;
  role: "investor" | "founder";
  company: string | null;
};

export type MatchPair = {
  key: string;
  a: Side;
  b: Side;
  sharedInterests: string[];
  score: number;
  status: "none" | "requested" | "accepted" | "declined";
  requestedBy: string | null;
};

export type NetworkingBoard = {
  /** Registered as an investor or a founder — the matchable pool. */
  matchable: number;
  registered: number;
  /** How many of the pool declared no sectors, so match only on role. */
  withoutSectors: number;
  pairs: MatchPair[];
  /** Pairs found, which can be far more than the page shows. */
  totalPairs: number;
  counts: { matches: number; requested: number; accepted: number; declined: number };
};

const EMPTY: NetworkingBoard = {
  matchable: 0, registered: 0, withoutSectors: 0, pairs: [], totalPairs: 0,
  counts: { matches: 0, requested: 0, accepted: 0, declined: 0 },
};

/** A 106-person event is ~5,600 pairs. Show the strongest; count them all. */
const MAX_ROWS = 400;

const pairKey = (a: string, b: string) => [a, b].sort().join("|");

/**
 * The sectors someone declared at registration.
 *
 * Investors answer `sectors` (many), founders answer `sector` (one) — and the
 * form has changed over time, so both shapes are accepted from either.
 */
function sectorsOf(answers: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const key of ["sectors", "sector"]) {
    const v = answers[key];
    if (Array.isArray(v)) out.push(...v.map(String));
    else if (typeof v === "string" && v.trim()) out.push(v.trim());
  }
  return [...new Set(out.map((s) => s.trim()).filter(Boolean))];
}

export async function loadNetworkingBoard(eventId: string): Promise<NetworkingBoard> {
  try {
    const db = raw();
    const [regsRes, connsRes] = await Promise.all([
      db.from("registrations")
        .select("id, attendee_id, attendee_type, answers, profiles:attendee_id(full_name)")
        .eq("event_id", eventId),
      db.from("networking_connections").select("from_id, to_id, status").eq("event_id", eventId),
    ]);
    if (regsRes.error) return EMPTY;

    const rows = (regsRes.data ?? []) as Row[];
    const people: { side: Side; sectors: string[] }[] = [];

    for (const r of rows) {
      const role = String(r.attendee_type ?? "").toLowerCase();
      if (role !== "investor" && role !== "founder") continue;

      const answers = (r.answers as Record<string, unknown> | null) ?? {};
      const profile = r.profiles as { full_name?: string | null } | null;
      const typed = typeof answers.name === "string" ? answers.name.trim() : "";
      const company = typeof answers.company === "string" ? answers.company.trim() : "";

      people.push({
        side: {
          profileId: (r.attendee_id as string | null) ?? null,
          registrationId: String(r.id),
          name: typed || profile?.full_name?.trim() || "Attendee",
          role,
          company: company || null,
        },
        sectors: sectorsOf(answers),
      });
    }

    // Connection status is keyed by profile, so it can only be shown for pairs
    // where both sides have an account. A guest's row simply has no status.
    const byPair = new Map<string, { status: MatchPair["status"]; requestedBy: string }>();
    for (const c of ((connsRes.data ?? []) as Row[])) {
      byPair.set(pairKey(String(c.from_id), String(c.to_id)), {
        status: String(c.status) as MatchPair["status"],
        requestedBy: String(c.from_id),
      });
    }

    const pairs: MatchPair[] = [];
    for (let i = 0; i < people.length; i += 1) {
      for (let j = i + 1; j < people.length; j += 1) {
        const [x, y] = [people[i], people[j]];
        const mine = new Set(x.sectors);
        const shared = y.sectors.filter((s) => mine.has(s));
        const complementary = x.side.role !== y.side.role;
        const score = shared.length * 2 + (complementary ? 3 : 0);
        if (score <= 0) continue;

        // Investor first, so a mixed pair reads the way an introduction would.
        // Two of the same kind keep the order they arrived in.
        const investorFirst = y.side.role === "investor" && x.side.role !== "investor";
        const a = investorFirst ? y.side : x.side;
        const b = investorFirst ? x.side : y.side;

        const conn = a.profileId && b.profileId ? byPair.get(pairKey(a.profileId, b.profileId)) : undefined;
        pairs.push({
          key: pairKey(x.side.registrationId, y.side.registrationId),
          a, b,
          sharedInterests: shared,
          score,
          status: conn?.status ?? "none",
          requestedBy: conn?.requestedBy ?? null,
        });
      }
    }

    pairs.sort((p, q) => q.score - p.score || p.a.name.localeCompare(q.a.name));
    const count = (s: MatchPair["status"]) => pairs.filter((p) => p.status === s).length;

    return {
      matchable: people.length,
      registered: rows.length,
      withoutSectors: people.filter((p) => p.sectors.length === 0).length,
      pairs: pairs.slice(0, MAX_ROWS),
      totalPairs: pairs.length,
      counts: {
        matches: pairs.length,
        requested: count("requested"),
        accepted: count("accepted"),
        declined: count("declined"),
      },
    };
  } catch {
    return EMPTY;
  }
}
