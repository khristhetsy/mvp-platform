/**
 * Networking Matching — the staff view of who matched with whom.
 *
 * Matches are not stored anywhere. `listSuggestions` computes them for one
 * viewer at page-load and throws them away, so there is no table to read: this
 * recomputes every pair from the opt-ins and joins the connection requests
 * that people actually sent.
 *
 * That is the honest shape of the feature today. Nothing here invites anyone —
 * connection requests come from attendees, and no email is sent when one is
 * made.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function raw(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

type Row = Record<string, unknown>;

export type Side = { profileId: string; name: string; role: string };

export type MatchPair = {
  key: string;
  a: Side;
  b: Side;
  sharedInterests: string[];
  score: number;
  /** Where a request between these two got to, when one was sent. */
  status: "none" | "requested" | "accepted" | "declined";
  /** Who sent it, when one was sent. */
  requestedBy: string | null;
};

export type NetworkingBoard = {
  optedIn: number;
  registered: number;
  pairs: MatchPair[];
  counts: { matches: number; requested: number; accepted: number; declined: number; noAnswer: number };
};

const EMPTY: NetworkingBoard = {
  optedIn: 0, registered: 0, pairs: [],
  counts: { matches: 0, requested: 0, accepted: 0, declined: 0, noAnswer: 0 },
};

/** The same rule the attendee-facing suggestions use, applied to every pair. */
function complementary(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return (x === "founder" && y === "investor") || (x === "investor" && y === "founder");
}

/** Stable key for an unordered pair, so A→B and B→A are the same match. */
const pairKey = (a: string, b: string) => [a, b].sort().join("|");

export async function loadNetworkingBoard(eventId: string): Promise<NetworkingBoard> {
  try {
    const db = raw();
    const [optinsRes, connsRes, regRes] = await Promise.all([
      db.from("networking_optins")
        .select("profile_id, interests, profiles:profile_id(full_name, role)")
        .eq("event_id", eventId).eq("opted_in", true),
      db.from("networking_connections").select("from_id, to_id, status").eq("event_id", eventId),
      db.from("registrations").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    ]);
    if (optinsRes.error) return EMPTY;

    const people = ((optinsRes.data ?? []) as Row[]).map((r) => {
      const p = r.profiles as { full_name?: string | null; role?: string | null } | null;
      return {
        side: { profileId: String(r.profile_id), name: p?.full_name ?? "Attendee", role: String(p?.role ?? "") } as Side,
        interests: Array.isArray(r.interests) ? (r.interests as string[]) : [],
      };
    });

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
        const mine = new Set(x.interests);
        const shared = y.interests.filter((s) => mine.has(s));
        const score = shared.length * 2 + (complementary(x.side.role, y.side.role) ? 3 : 0);
        if (score <= 0) continue;

        // Investor first when the pair is a founder↔investor one: the table
        // reads left-to-right as "investor, founder", like the invitation will.
        const investorFirst = y.side.role.toLowerCase() === "investor";
        const a = investorFirst ? y.side : x.side;
        const b = investorFirst ? x.side : y.side;

        const key = pairKey(x.side.profileId, y.side.profileId);
        const conn = byPair.get(key);
        pairs.push({
          key, a, b,
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
      optedIn: people.length,
      registered: regRes.count ?? 0,
      pairs,
      counts: {
        matches: pairs.length,
        requested: count("requested"),
        accepted: count("accepted"),
        declined: count("declined"),
        noAnswer: count("requested"),
      },
    };
  } catch {
    return EMPTY;
  }
}
