// SEC Form D ingest (build spec §4). Runtime-agnostic core: the daily-index
// parser, the non-negotiable request rules, and the day orchestration are pure
// functions with an injected fetch + storage, so they run in a Supabase Edge
// Function (Deno) and under vitest (Node) unchanged.

import { parseFormD, daysSinceFirstSale } from "./parse.ts";
import { scoreFormD } from "./score.ts";
import type { FormDFiling } from "./types.ts";

const EDGAR = "https://www.sec.gov";

export type IndexRow = {
  formType: string;      // 'D' | 'D/A'
  companyName: string;
  cik: string;           // leading zeros stripped
  dateFiled: string;     // YYYY-MM-DD
  accessionNo: string;   // 0001234567-25-000001
  primaryDocUrl: string; // absolute
};

/** Absolute URL of a filing's primary_doc.xml. */
export function primaryDocUrl(cik: string, accessionNo: string): string {
  const noDash = accessionNo.replace(/-/g, "");
  return `${EDGAR}/Archives/edgar/data/${cik}/${noDash}/primary_doc.xml`;
}

/** Absolute URL of the daily form index for a date. */
export function dailyIndexUrl(date: Date): string {
  const y = date.getUTCFullYear();
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  const yyyymmdd = `${y}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  return `${EDGAR}/Archives/edgar/daily-index/${y}/QTR${q}/form.${yyyymmdd}.idx`;
}

/**
 * Parse an EDGAR daily form index into Form D rows. Keeps only 'D' and 'D/A',
 * strips leading zeros from the CIK, derives the accession + primary_doc URL.
 * Robust to the variable-width company-name column by anchoring on the trailing
 * `edgar/data/{cik}/{accession}.txt` path.
 */
export function parseDailyIndex(text: string): IndexRow[] {
  const rows: IndexRow[] = [];
  const re = /^(D|D\/A)\s+(.+?)\s+(\d+)\s+(\d{4}-\d{2}-\d{2})\s+(edgar\/data\/\d+\/([\d-]+)\.txt)\s*$/;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(re);
    if (!m) continue;
    const cik = m[3].replace(/^0+/, "") || m[3];
    const accessionNo = m[6];
    rows.push({
      formType: m[1],
      companyName: m[2].trim(),
      cik,
      dateFiled: m[4],
      accessionNo,
      primaryDocUrl: primaryDocUrl(cik, accessionNo),
    });
  }
  return rows;
}

/** The User-Agent is required by the SEC; the job MUST abort at startup without it (§4.4, §13.5). */
export function requireUserAgent(env: Record<string, string | undefined>): string {
  const ua = env.SEC_USER_AGENT?.trim();
  if (!ua) throw new Error("SEC_USER_AGENT is not set — refusing to hit EDGAR without a declared contact (SEC requirement).");
  return ua;
}

const RETRYABLE = new Set([403, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type FetchResult = { status: number; text: string };
export type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<FetchResult>;

/**
 * SEC-polite fetch: declares the UA + gzip, retries 403/429/5xx with exponential
 * backoff (4 attempts). Returns 404 as a normal result (post-acceptance
 * correction, not an error — §4.4). Throws only on exhausted retries.
 */
export async function secFetch(fetchImpl: FetchLike, url: string, userAgent: string, attempts = 4): Promise<FetchResult> {
  const headers = { "User-Agent": userAgent, "Accept-Encoding": "gzip, deflate" };
  let lastStatus = 0;
  for (let i = 0; i < attempts; i++) {
    const res = await fetchImpl(url, { headers });
    if (res.status === 404 || (res.status >= 200 && res.status < 300)) return res;
    lastStatus = res.status;
    if (!RETRYABLE.has(res.status)) return res;
    if (i < attempts - 1) await sleep(500 * 2 ** i); // 0.5s, 1s, 2s
  }
  throw new Error(`SEC request failed after ${attempts} attempts (last status ${lastStatus}): ${url}`);
}

/** Simple ~N req/sec pacer. */
export function rateLimiter(perSecond: number) {
  const minGap = 1000 / perSecond;
  let last = 0;
  return async () => {
    const now = Date.now();
    const wait = last + minGap - now;
    if (wait > 0) await sleep(wait);
    last = Date.now();
  };
}

export type IngestDeps = {
  fetchImpl: FetchLike;
  userAgent: string;
  /** Upsert parsed filings + their related persons (idempotent, onConflict accession). */
  upsert: (filing: FormDFiling & { formdScore: number; scoreNotes: string; derivedFundingStage: string | null; derivedInvestorType: string | null }) => Promise<void>;
  reqPerSec?: number;
  asOf?: Date;
};

export type IngestResult = { date: string; indexed: number; parsed: number; upserted: number; notFound: number; errors: number };

/** Ingest one day: fetch index → parse each filing → score/derive → upsert. Idempotent. */
export async function ingestDay(date: Date, deps: IngestDeps): Promise<IngestResult> {
  const asOf = deps.asOf ?? new Date();
  const pace = rateLimiter(deps.reqPerSec ?? 7);
  const result: IngestResult = { date: dailyIndexUrl(date), indexed: 0, parsed: 0, upserted: 0, notFound: 0, errors: 0 };

  await pace();
  const idx = await secFetch(deps.fetchImpl, dailyIndexUrl(date), deps.userAgent);
  if (idx.status === 404) return result; // federal holiday — tolerate, don't fail
  const rows = parseDailyIndex(idx.text);
  result.indexed = rows.length;

  for (const row of rows) {
    try {
      await pace();
      const doc = await secFetch(deps.fetchImpl, row.primaryDocUrl, deps.userAgent);
      if (doc.status === 404) { result.notFound += 1; continue; } // post-acceptance correction
      if (doc.status >= 400) { result.errors += 1; continue; }
      const filing = parseFormD(doc.text, {
        accessionNo: row.accessionNo,
        cik: row.cik,
        formType: row.formType,
        dateFiled: row.dateFiled,
        filingUrl: `${EDGAR}/Archives/edgar/data/${row.cik}/${row.accessionNo.replace(/-/g, "")}/`,
      });
      filing.daysSinceFirstSale = daysSinceFirstSale(filing.dateFirstSale, asOf);
      const s = scoreFormD(filing);
      result.parsed += 1;
      await deps.upsert({ ...filing, formdScore: s.score, scoreNotes: s.notes, derivedFundingStage: s.fundingStage, derivedInvestorType: s.investorType });
      result.upserted += 1;
    } catch {
      result.errors += 1;
    }
  }
  return result;
}

export type RecomputeDeps = {
  /** Full unpromoted filings (incl. relatedPersons for the reachability score). */
  loadUnpromoted: () => Promise<FormDFiling[]>;
  update: (accessionNo: string, patch: {
    daysSinceFirstSale: number | null;
    formdScore: number;
    scoreNotes: string;
    derivedFundingStage: string | null;
    derivedInvestorType: string | null;
  }) => Promise<void>;
  asOf?: Date;
};

/**
 * Nightly recompute (§4.7): refresh days_since_first_sale and re-score unpromoted
 * rows. This is what surfaces leads aging into the stall window without a new
 * filing arriving.
 */
export async function recomputeUnpromoted(deps: RecomputeDeps): Promise<{ updated: number }> {
  const asOf = deps.asOf ?? new Date();
  const rows = await deps.loadUnpromoted();
  let updated = 0;
  for (const f of rows) {
    f.daysSinceFirstSale = daysSinceFirstSale(f.dateFirstSale, asOf);
    const s = scoreFormD(f);
    await deps.update(f.accessionNo, {
      daysSinceFirstSale: f.daysSinceFirstSale,
      formdScore: s.score,
      scoreNotes: s.notes,
      derivedFundingStage: s.fundingStage,
      derivedInvestorType: s.investorType,
    });
    updated += 1;
  }
  return { updated };
}
