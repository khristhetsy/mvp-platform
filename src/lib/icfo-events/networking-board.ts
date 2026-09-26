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
import { listIntroductions } from "@/lib/icfo-events/introductions-server";
import { matchableFromAnswers, pairScore, sectorsOf, sharedSectors, type Matchable } from "@/lib/icfo-events/matching-rule";
import {
  DEFAULT_PAIR_TYPES, PAIR_TYPES, matchableRoles, medianScore, pairTypeOf, sanitizeRules, scoreBands,
  type PairTypeKey, type Role, type ScoreBand,
} from "@/lib/icfo-events/pair-types";

function raw(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

type Row = Record<string, unknown>;

export type Side = {
  /** Null for a guest registered without an account. */
  profileId: string | null;
  /** For a presenter this is `presenter:<id>` — they have no registration. */
  registrationId: string;
  name: string;
  role: Role;
  company: string | null;
};

export type MatchPair = {
  key: string;
  a: Side;
  b: Side;
  sharedInterests: string[];
  score: number;
  /**
   * `accepted` means the investor said yes and nobody has set a time yet —
   * the stall the scheduling step introduced. `scheduled` is a real meeting.
   */
  status: "none" | "requested" | "accepted" | "scheduled" | "declined";
  requestedBy: string | null;
  /** Set once we have sent an introduction for this pair. */
  introductionId: string | null;
  followUps: number;
  /** The slot the founder gave, and the link they brought. */
  scheduledAt: string | null;
  meetingUrl: string | null;
  /** Reminders sent to the founder for a time they have not given. */
  founderReminders: number;
  /** The investor asked for a different slot and is waiting again. */
  rescheduleAsked: boolean;
  /** Which pairing produced this row, and so which message it would get. */
  pairType: PairTypeKey;
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
  counts: {
    matches: number; requested: number; accepted: number; declined: number;
    notSent: number; scheduled: number;
  };
  /** The pairings in force, and how the scores are spread. */
  rules: PairTypeKey[];
  bands: ScoreBand[];
  median: number | null;
  /** Pairs each rule would produce, whether or not it is switched on. */
  byPairType: Record<string, { pairs: number; median: number | null }>;
};

const EMPTY: NetworkingBoard = {
  matchable: 0, registered: 0, withoutSectors: 0, pairs: [], totalPairs: 0,
  counts: { matches: 0, requested: 0, accepted: 0, declined: 0, notSent: 0, scheduled: 0 },
  rules: DEFAULT_PAIR_TYPES,
  bands: [],
  median: null,
  byPairType: {},
};

/** A 106-person event is ~5,600 pairs. Show the strongest; count them all. */
const MAX_ROWS = 400;

const pairKey = (a: string, b: string) => [a, b].sort().join("|");

const ALL_PAIR_KEYS: PairTypeKey[] = PAIR_TYPES.map((p) => p.key);

/**
 * How a role scores.
 *
 * The scoring rule knows two roles — an investor and a founder are worth
 * meeting whatever they declared. Everyone else matches on shared sectors
 * alone, so they are scored as the same side.
 */
function scoreRole(role: Role): "investor" | "founder" {
  return role === "investor" ? "investor" : "founder";
}

export async function loadNetworkingBoard(eventId: string): Promise<NetworkingBoard> {
  try {
    const db = raw();
    const [regsRes, connsRes, intros, rulesRes, presentersRes] = await Promise.all([
      db.from("registrations")
        .select("id, attendee_id, attendee_type, answers, profiles:attendee_id(full_name)")
        .eq("event_id", eventId),
      db.from("networking_connections").select("from_id, to_id, status").eq("event_id", eventId),
      listIntroductions(eventId),
      db.from("event_matching_rules").select("pair_types").eq("event_id", eventId).maybeSingle(),
      db.from("event_presenters").select("id, profile_id, display_name, role_label").eq("event_id", eventId),
    ]);
    if (regsRes.error) return EMPTY;

    const rules = sanitizeRules((rulesRes.data as Row | null)?.pair_types);

    const rows = (regsRes.data ?? []) as Row[];
    // `extra` carries stage and check size for real investors and founders; other
    // roles (service, sponsor, presenter) have none and score as before.
    const people: { side: Side; sectors: string[]; extra?: Pick<Matchable, "stages" | "money"> }[] = [];

    for (const r of rows) {
      const role = String(r.attendee_type ?? "").toLowerCase();
      if (role !== "investor" && role !== "founder" && role !== "service" && role !== "sponsor") continue;

      const answers = (r.answers as Record<string, unknown> | null) ?? {};
      const profile = r.profiles as { full_name?: string | null } | null;
      const typed = typeof answers.name === "string" ? answers.name.trim() : "";
      const company = typeof answers.company === "string" ? answers.company.trim() : "";

      people.push({
        side: {
          profileId: (r.attendee_id as string | null) ?? null,
          registrationId: String(r.id),
          name: typed || profile?.full_name?.trim() || "Attendee",
          role: role as Role,
          company: company || null,
        },
        sectors: sectorsOf(answers),
        ...(role === "investor" || role === "founder"
          ? (() => {
              const m = matchableFromAnswers(role, answers);
              return { extra: { stages: m.stages, money: m.money } };
            })()
          : {}),
      });
    }

    // Presenters are not registrations — they are the event's own speaker list,
    // and carry no sector answers, so they match on role alone.
    for (const p of ((presentersRes.data ?? []) as Row[])) {
      people.push({
        side: {
          profileId: (p.profile_id as string | null) ?? null,
          registrationId: `presenter:${String(p.id)}`,
          name: String(p.display_name ?? "Presenter"),
          role: "presenter",
          company: (p.role_label as string | null) ?? null,
        },
        sectors: [],
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

    // Introductions we sent, keyed the same way as the pairs.
    const introByPair = new Map(
      intros.map((i) => [pairKey(i.investorRegId, i.founderRegId), i]),
    );

    const eligible = matchableRoles(rules);
    const pairs: MatchPair[] = [];
    // Every rule's yield, whether or not it is switched on — the rules tab
    // shows what turning one on would add before you turn it on.
    const byPairType = new Map<string, number[]>();

    for (let i = 0; i < people.length; i += 1) {
      for (let j = i + 1; j < people.length; j += 1) {
        const [x, y] = [people[i], people[j]];

        // Which pairing this is, if any: staff decide which kinds of pair the
        // event generates, and a pair nobody enabled is not a match.
        const type = pairTypeOf(x.side.role, y.side.role, rules);
        const anyType = pairTypeOf(x.side.role, y.side.role, ALL_PAIR_KEYS);

        // The same scoring rule the public event page counts with, so the two
        // numbers can never disagree. Roles beyond investor/founder score on
        // shared sectors alone.
        const left: Matchable = { role: scoreRole(x.side.role), sectors: x.sectors, ...x.extra };
        const right: Matchable = { role: scoreRole(y.side.role), sectors: y.sectors, ...y.extra };
        const score = pairScore(left, right);

        if (anyType && score > 0) {
          const bucket = byPairType.get(anyType.key) ?? [];
          bucket.push(score);
          byPairType.set(anyType.key, bucket);
        }

        if (!type || score <= 0) continue;
        const shared = sharedSectors(left, right);

        // Investor first, so a mixed pair reads the way an introduction would.
        // Two of the same kind keep the order they arrived in.
        const investorFirst = y.side.role === "investor" && x.side.role !== "investor";
        const a = investorFirst ? y.side : x.side;
        const b = investorFirst ? x.side : y.side;

        const key = pairKey(x.side.registrationId, y.side.registrationId);
        // An introduction we sent outranks an attendee-to-attendee request:
        // it is the thing staff acted on and the thing they are waiting for.
        const intro = introByPair.get(key);
        const conn = a.profileId && b.profileId ? byPair.get(pairKey(a.profileId, b.profileId)) : undefined;
        const status: MatchPair["status"] = intro
          ? intro.status === "sent"
            ? "requested"
            : intro.status === "accepted" && intro.scheduledAt
              ? "scheduled"
              : intro.status
          : conn?.status ?? "none";

        pairs.push({
          key,
          a, b,
          sharedInterests: shared,
          score,
          status,
          requestedBy: intro ? null : conn?.requestedBy ?? null,
          introductionId: intro?.id ?? null,
          followUps: intro?.followUps ?? 0,
          scheduledAt: intro?.scheduledAt ?? null,
          meetingUrl: intro?.meetingUrl ?? null,
          founderReminders: intro?.founderReminders ?? 0,
          rescheduleAsked: Boolean(intro?.rescheduleRequestedAt),
          pairType: type.key,
        });
      }
    }

    pairs.sort((p, q) => q.score - p.score || p.a.name.localeCompare(q.a.name));
    const count = (s: MatchPair["status"]) => pairs.filter((p) => p.status === s).length;

    const scores = pairs.map((p) => p.score);

    return {
      rules,
      bands: scoreBands(scores),
      median: medianScore(scores),
      byPairType: Object.fromEntries(
        [...byPairType].map(([k, v]) => [k, { pairs: v.length, median: medianScore(v) }]),
      ),
      // The pool these rules could pair — not everybody in the room.
      matchable: people.filter((p) => eligible.has(p.side.role)).length,
      registered: rows.length,
      withoutSectors: people.filter((p) => eligible.has(p.side.role) && p.sectors.length === 0).length,
      pairs: pairs.slice(0, MAX_ROWS),
      totalPairs: pairs.length,
      counts: {
        matches: pairs.length,
        requested: count("requested"),
        accepted: count("accepted"),
        declined: count("declined"),
        notSent: count("none"),
        scheduled: count("scheduled"),
      },
    };
  } catch {
    return EMPTY;
  }
}
