/**
 * Investor matches for a meeting booking. When a founder books a call, the booking
 * answers (raising, stage, industry, raise size) are run through the same matcher
 * as /fit, and the top matches go to the HOST only: the host email and the
 * contact's Note Log. They are never put in the calendar event description,
 * because Google shows that description to the invited founder.
 *
 * Everything here is best-effort. A slow or failed match must never block or fail a
 * booking, so every entry point returns null or swallows its error.
 */

import { matchInvestors } from "@/lib/fit/match-investors";
import { toPublicMatch } from "@/lib/fit/public-match";
import { canonicalizeIndustries } from "@/lib/industries/canonical";
import type { FitAnswers } from "@/lib/fit/options";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { appendContactNote } from "@/lib/sales/contacts";
import { bookingProfile, raiseKey, stageKey, type BookingAnswer } from "./booking-profile";

export type BookingMatch = { company: string; fit: number; detail: string };
export type BookingMatches = { matches: BookingMatch[]; total: number };

const TOP_N = 5;
const MATCH_TIMEOUT_MS = 3500;

const find = (answers: BookingAnswer[], re: RegExp) => answers.find((a) => re.test(a.label))?.value?.trim() ?? "";

function amounts(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\$?\s*(\d+(?:\.\d+)?)\s*([kmb])?\b/gi)) {
    const unit = (m[2] ?? "").toLowerCase();
    const mult = unit === "k" ? 1e3 : unit === "m" ? 1e6 : unit === "b" ? 1e9 : 1;
    out.push(Number(m[1]) * mult);
  }
  return out;
}

const BANDS: Array<{ key: string; min: number; max: number }> = [
  { key: "under_1m", min: 0, max: 1_000_000 },
  { key: "1m_10m", min: 1_000_000, max: 10_000_000 },
  { key: "over_10m", min: 10_000_000, max: Number.MAX_SAFE_INTEGER },
];

/** Raise-size answer to /fit raise keys. "$1M to $5M" gives ["1m_10m"]. */
export function raiseKeysFor(value: string): string[] {
  const known = raiseKey(value);
  if (known) return [known];
  const nums = amounts(value);
  if (nums.length === 0) return [];
  let lo = Math.min(...nums);
  let hi = Math.max(...nums);
  if (nums.length === 1) {
    if (/\b(under|less|below|up to)\b/i.test(value)) { hi = lo; lo = 0; }
    else if (/\b(over|more|above|plus)\b|\+/i.test(value)) { hi = Number.MAX_SAFE_INTEGER; }
  }
  const keys = lo === hi
    ? BANDS.filter((b) => lo >= b.min && lo < b.max)
    : BANDS.filter((b) => lo < b.max && hi > b.min);
  return keys.map((b) => b.key);
}

/** Booking answers to the matcher's inputs. Null unless this is a founder raising with a known industry. */
export function answersToFit(answers: BookingAnswer[]): FitAnswers | null {
  const profile = bookingProfile(answers);
  if (profile.module !== "founder") return null;
  const industry = canonicalizeIndustries([find(answers, /industry|sector/i)]);
  if (industry.length === 0) return null;
  const stage = profile.booking.stage ?? stageKey(find(answers, /company stage/i));
  const raise = raiseKeysFor(find(answers, /raise size/i));
  return {
    stage: stage ? [stage] : [],
    raise,
    industry,
    revenue: stage === "pre_revenue" ? ["pre_revenue"] : [],
    investorType: [],
  };
}

/** Top matches for a booking, or null when it does not apply or the matcher is slow or fails. */
export async function investorMatchesForBooking(answers: BookingAnswer[] | undefined): Promise<BookingMatches | null> {
  try {
    const fit = answersToFit(answers ?? []);
    if (!fit) return null;
    const result = await Promise.race([
      matchInvestors(fit, { variant: "v2" }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), MATCH_TIMEOUT_MS)),
    ]);
    if (!result || result.top.length === 0) return null;
    const matches = result.top.slice(0, TOP_N).map((m, i) => {
      const p = toPublicMatch(m, fit, i);
      return {
        company: p.company ?? "Investor",
        fit: Math.round(p.fit),
        detail: [p.title, p.detail].filter(Boolean).join(" · "),
      };
    });
    return { matches, total: result.matched_count };
  } catch (err) {
    console.error("[scheduling/booking-matches] failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Pacific time, per the platform rule that every date and time uses PT. */
function ptStamp(d: Date): string {
  const s = d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "2-digit", day: "2-digit", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
  return `${s.replace(",", "")} PT`;
}

export function buildMatchNote(input: { bookingId: string | null; answers: BookingAnswer[]; result: BookingMatches; when?: Date }): string {
  const { answers, result } = input;
  const row = (label: string, re: RegExp) => `${label}: ${find(answers, re) || "not given"}`;
  return [
    `Booking match review (${ptStamp(input.when ?? new Date())})`,
    row("Sector", /industry|sector/i),
    row("Raise", /raise size/i),
    row("Stage", /company stage/i),
    row("Time to close", /time to close/i),
    `${result.matches.length} of ${result.total} matched investor${result.total === 1 ? "" : "s"} shown to host:`,
    ...result.matches.map((m, i) => `${i + 1}. ${m.company} (${m.fit}%)`),
    ...(input.bookingId ? [`Booking: ${input.bookingId}`] : []),
  ].join("\n");
}

/** Add the match review to the booker's contact Note Log. One entry per booking. Never throws. */
export async function logBookingMatchNote(input: { email: string | null; bookingId: string | null; answers: BookingAnswer[]; result: BookingMatches }): Promise<void> {
  try {
    if (!input.email) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceRoleClient() as any;
    const { data } = await db.from("crm_contacts").select("id, source, external_id, module").ilike("email", input.email.trim()).limit(10);
    const rows: Array<{ id: string; source: string | null; external_id: string | null; module: string | null }> = Array.isArray(data) ? data : [];
    if (rows.length === 0) return;
    // Same duplicate rule as the /fit note: prefer the record /fit or the booking created, then a Founder record.
    const rank = (r: { source: string | null; module: string | null }) => (r.source === "fit" || r.source === "booking" ? 0 : r.module === "founder" ? 1 : 2);
    rows.sort((a, b) => rank(a) - rank(b));
    const contact = rows[0];

    if (input.bookingId) {
      const { data: ann } = await db.from("crm_contact_annotations").select("notes").eq("source", contact.source).eq("external_id", contact.external_id).maybeSingle();
      if (ann?.notes && String(ann.notes).includes(`Booking: ${input.bookingId}`)) return;
    }
    await appendContactNote(contact.id, buildMatchNote({ bookingId: input.bookingId, answers: input.answers, result: input.result }), null);
  } catch (err) {
    console.error("[scheduling/booking-matches] note failed:", err instanceof Error ? err.message : err);
  }
}
