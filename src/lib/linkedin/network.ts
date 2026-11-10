// Audience read from your own LinkedIn 1st connections. No CRM and no import: the sender reads
// a few pages of LinkedIn's own connection search each day and iCapOS keeps the people it finds.
// Pure helpers only, so every rule is unit tested.
import { DEFAULT_TITLES, MATCH_CHECK_MAX_MINUTES, MAX_RESULT_PAGES, MAX_TITLES, READ_PAGES_PER_DAY, matchKey } from "./limits";
import { startOfLocalDay } from "./worker";

export { DEFAULT_TITLES, MATCH_CHECK_MAX_MINUTES, MAX_RESULT_PAGES, MAX_TITLES, READ_PAGES_PER_DAY, matchKey };
/** Minutes between two page reads. */
export const READ_GAP_MINUTES = 10;
/** Read more people only when fewer than this many are still waiting for a message. */
export const READ_WHEN_QUEUED_BELOW = 10;
export const SORTS = ["recent", "first", "last"] as const;
export type NetworkSort = (typeof SORTS)[number];

export type NetworkFilters = {
  industry?: string; locations?: string; currentCompany?: string; pastCompany?: string; school?: string;
  profileLanguage?: string; name?: string; sort: NetworkSort;
  /** Only people whose headline has one of these words are kept. Empty or missing keeps everyone. */
  titles?: string[];
};

export type NetworkProgress = {
  /** The next result page to read, starting at 1. */
  page: number; done: boolean; found: number;
  /** LinkedIn's own address of the filtered search, saved after page 1 so later pages need no clicking. */
  searchUrl: string | null;
  /** Start of the owner's local day for the counter below. */
  readDay: string | null; readToday: number; readAt: string | null;
};

export const EMPTY_PROGRESS: NetworkProgress = { page: 1, done: false, found: 0, searchUrl: null, readDay: null, readToday: 0, readAt: null };

export function isNetworkAudience(audience: Record<string, unknown> | null | undefined): boolean {
  return audience?.source === "linkedin_network";
}

const TEXT_KEYS = ["industry", "locations", "currentCompany", "pastCompany", "school", "profileLanguage", "name"] as const;

export function readNetworkFilters(audience: Record<string, unknown>): NetworkFilters {
  const f = (audience.filters ?? {}) as Record<string, unknown>;
  const out: NetworkFilters = { sort: (SORTS as readonly string[]).includes(f.sort as string) ? (f.sort as NetworkSort) : "recent" };
  for (const k of TEXT_KEYS) {
    const v = f[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 80);
  }
  if (Array.isArray(f.titles)) {
    const t = readTitles(f.titles);
    if (t.length > 0) out.titles = t;
  }
  return out;
}

/** Clean list of title words: trimmed, unique ignoring case, at most 12, each at most 30 characters. */
export function readTitles(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of v) {
    const t = typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, 30) : "";
    if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push(t); }
    if (out.length >= MAX_TITLES) break;
  }
  return out;
}

/** True when the headline contains one of the words as a whole word, ignoring case. No titles set keeps everyone. */
export function matchesTitles(headline: string | null | undefined, titles: string[] | undefined): boolean {
  if (!titles || titles.length === 0) return true;
  if (!headline) return false;
  const h = headline.toLowerCase();
  return titles.some((t) => {
    const w = t.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${w}($|[^a-z0-9])`, "i").test(h);
  });
}

/** True when any filter that LinkedIn applies through its filter panel is set (a name goes in the address instead). */
export function needsFilterPanel(f: NetworkFilters): boolean {
  return !!(f.industry || f.locations || f.currentCompany || f.pastCompany || f.school || f.profileLanguage) || f.sort !== "recent";
}

export function readProgress(audience: Record<string, unknown>): NetworkProgress {
  const p = (audience.progress ?? {}) as Partial<NetworkProgress>;
  const n = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
  const s = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    page: Math.max(1, n(p.page, 1)), done: p.done === true, found: n(p.found, 0),
    searchUrl: isSearchUrl(p.searchUrl) ? (p.searchUrl as string) : null,
    readDay: s(p.readDay), readToday: n(p.readToday, 0), readAt: s(p.readAt),
  };
}

/** Only LinkedIn's people search address is ever followed. Anything else is ignored. */
export function isSearchUrl(u: unknown): boolean {
  if (typeof u !== "string" || u.length > 2000) return false;
  try {
    const x = new URL(u);
    return x.protocol === "https:" && x.hostname === "www.linkedin.com" && x.pathname.startsWith("/search/results/people");
  } catch {
    return false;
  }
}

/** The profile slug of a /in/ address or a bare slug, lower case, or null. */
export function cleanSlug(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = /linkedin\.com\/in\/([A-Za-z0-9_%-]+)/i.exec(input.trim()) ?? /^([A-Za-z0-9_%-]{2,100})$/.exec(input.trim());
  if (!m) return null;
  let s = m[1];
  try { s = decodeURIComponent(s); } catch { /* keep as is */ }
  s = s.toLowerCase();
  // LinkedIn hides names behind ids that start with ACo or ACw. Those are not usable profile links.
  return /^ac[ow][a-z0-9_-]{20,}$/i.test(s) ? null : s;
}

export type ReadDecision = { ok: true } | { ok: false; reason: "done" | "enough_queued" | "daily_reads" | "read_gap" };

export function canReadNow(i: { progress: NetworkProgress; queued: number; now: Date; timeZone: string }): ReadDecision {
  const p = i.progress;
  if (p.done || p.page > MAX_RESULT_PAGES) return { ok: false, reason: "done" };
  if (i.queued >= READ_WHEN_QUEUED_BELOW) return { ok: false, reason: "enough_queued" };
  const day = startOfLocalDay(i.now, i.timeZone).toISOString();
  if (p.readDay === day && p.readToday >= READ_PAGES_PER_DAY) return { ok: false, reason: "daily_reads" };
  if (p.readAt && i.now.getTime() - new Date(p.readAt).getTime() < READ_GAP_MINUTES * 60_000) return { ok: false, reason: "read_gap" };
  return { ok: true };
}

/** Progress after the sender reports a page. An empty page, or the last page, ends the reading. */
export function afterRead(p: NetworkProgress, r: { page: number; added: number; seen: number; searchUrl?: string | null; now: Date; timeZone: string }): NetworkProgress {
  const day = startOfLocalDay(r.now, r.timeZone).toISOString();
  const readToday = (p.readDay === day ? p.readToday : 0) + 1;
  const empty = r.seen === 0;
  return {
    page: empty ? p.page : r.page + 1,
    done: empty || r.page >= MAX_RESULT_PAGES,
    found: p.found + r.added,
    searchUrl: isSearchUrl(r.searchUrl) ? (r.searchUrl as string) : p.searchUrl,
    readDay: day, readToday, readAt: r.now.toISOString(),
  };
}

/** The progress to store when a read failed: the same page is tried again after the gap. */
export function afterFailedRead(p: NetworkProgress, now: Date, timeZone: string): NetworkProgress {
  const day = startOfLocalDay(now, timeZone).toISOString();
  return { ...p, readDay: day, readToday: (p.readDay === day ? p.readToday : 0) + 1, readAt: now.toISOString() };
}

/** One "how many of my connections match" count, asked for on the New campaign form and answered by the sender. */
export type MatchCheck = {
  id: string; status: "pending" | "done" | "failed"; requestedAt: string; key: string; filters: NetworkFilters;
  total: number | null; detail: string | null; doneAt: string | null;
};
export type MatchState = "none" | "pending" | "done" | "failed" | "unanswered";

export function readMatchCheck(raw: unknown): MatchCheck | null {
  const r = raw as Partial<MatchCheck> | null;
  if (!r || typeof r !== "object" || typeof r.id !== "string" || typeof r.requestedAt !== "string") return null;
  if (r.status !== "pending" && r.status !== "done" && r.status !== "failed") return null;
  const total = typeof r.total === "number" && Number.isFinite(r.total) && r.total >= 0 ? Math.floor(r.total) : null;
  return {
    id: r.id, status: r.status, requestedAt: r.requestedAt, key: typeof r.key === "string" ? r.key : "",
    filters: readNetworkFilters({ filters: r.filters ?? {} }), total,
    detail: typeof r.detail === "string" ? r.detail.slice(0, 300) : null, doneAt: typeof r.doneAt === "string" ? r.doneAt : null,
  };
}

/** A request the sender has not answered in 10 minutes counts as unanswered (extension closed, Chrome off). */
export function matchState(mc: MatchCheck | null, now: Date): MatchState {
  if (!mc) return "none";
  if (mc.status !== "pending") return mc.status;
  return now.getTime() - new Date(mc.requestedAt).getTime() > MATCH_CHECK_MAX_MINUTES * 60_000 ? "unanswered" : "pending";
}
