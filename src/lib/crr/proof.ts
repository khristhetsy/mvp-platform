/**
 * Founder CRR Proof: the figures behind an award entry, read from the platform's
 * own records.
 *
 * Pure and DB free, so every number and every sentence can be tested without a
 * database. The loader that fills these shapes is proof-db.ts.
 *
 * Honesty rules this file keeps:
 *  · A "before and after" exists only when a company has two or more score rows.
 *  · Both ends are scored under the SAME (active) weighting, so the change is
 *    like for like and a weight edit never reads as founder progress.
 *  · Investor activity is a count of platform records, never an estimate. A
 *    company with no records has `activity: null`, which is "none recorded",
 *    not a zero the founder earned.
 *  · Copy states what was measured. It never says iCapOS caused an outcome.
 */
import type { Band, Dimension, ProfileKey } from "@/lib/crr/profiles";
import type { FactorGap } from "@/lib/crr/improvement";
import type { Bands } from "@/lib/crr/weight-sets";

export type ProofQuote = "yes" | "pending" | "none";

/** Counts of platform records for one company. */
export type ProofActivity = { meetings: number; conversations: number; intros: number };

export type ProofScore = {
  score: number;
  at: string;
  band: Band;
  dims: Record<Dimension, number>;
};

export type ProofCompany = {
  companyId: string;
  companyName: string;
  founderName: string | null;
  founderEmail: string | null;
  industry: string | null;
  profile: ProfileKey;
  profileLabel: string;
  /** First and latest score rows, both under the active weighting. */
  first: ProofScore | null;
  latest: ProofScore | null;
  /** Every score row, oldest first, same weighting. */
  history: Array<{ score: number; at: string }>;
  quote: ProofQuote;
  /** null when the platform holds no meeting, conversation or intro record. */
  activity: ProofActivity | null;
  /** Factor gaps at the latest score, at the company's own stage. */
  gaps: FactorGap[];
};

export type ProofPayload = {
  generatedAt: string;
  gate: number;
  bands: Bands;
  companies: ProofCompany[];
};

const DAY = 86_400_000;

/** Whole months between two ISO timestamps, never negative. */
export function monthsBetween(a: string, b: string): number {
  const days = (Date.parse(b) - Date.parse(a)) / DAY;
  if (!Number.isFinite(days)) return 0;
  return Math.max(0, Math.round(days / 30.4375));
}

export function monthsLabel(n: number): string {
  if (n < 1) return "under a month";
  return `${n} month${n === 1 ? "" : "s"}`;
}

export function signed(n: number): string {
  const r = Math.round(n * 10) / 10;
  return r > 0 ? `+${r}` : String(r);
}

export function isMeasured(c: ProofCompany): boolean {
  return !!c.first && !!c.latest && c.history.length >= 2;
}

/** Latest minus first, or null when there is no before and after. */
export function changeOf(c: ProofCompany): number | null {
  return isMeasured(c) ? c.latest!.score - c.first!.score : null;
}

export function monthsOf(c: ProofCompany): number {
  return c.first && c.latest ? monthsBetween(c.first.at, c.latest.at) : 0;
}

/** A measured change a judge could reasonably question, and why. */
export type EvidenceFlag = { key: "low_baseline" | "short_span" | "tiny_change"; label: string };

export const LOW_BASELINE = 10;
export const SHORT_SPAN_DAYS = 30;
export const TINY_CHANGE = 5;

/**
 * Cautions on a before and after. They do not remove a founder from the
 * count, they say what to verify before stating the figure: a first score
 * under 10 is often an incomplete profile, a span under a month is often
 * re-scoring while documents were uploaded, and a change under 5 points is not
 * evidence of progress.
 */
export function evidenceFlags(c: ProofCompany): EvidenceFlag[] {
  if (!isMeasured(c)) return [];
  const out: EvidenceFlag[] = [];
  const days = (Date.parse(c.latest!.at) - Date.parse(c.first!.at)) / DAY;
  if (c.first!.score < LOW_BASELINE) out.push({ key: "low_baseline", label: `First score ${c.first!.score}, check it was a complete profile` });
  if (Number.isFinite(days) && days < SHORT_SPAN_DAYS) out.push({ key: "short_span", label: `Measured over ${Math.max(0, Math.round(days))} days` });
  if (Math.abs(c.latest!.score - c.first!.score) < TINY_CHANGE) out.push({ key: "tiny_change", label: "Change under 5 points" });
  return out;
}

export type MissingKey ="baseline" | "quote_pending" | "quote_none" | "activity";
export type Missing = { key: MissingKey; label: string; tone: "bad" | "warn" };

/** What stops a company being proven on all three: baseline, quote, activity. */
export function missingFor(c: ProofCompany): Missing[] {
  const out: Missing[] = [];
  if (!isMeasured(c)) out.push({ key: "baseline", label: "No before and after", tone: "bad" });
  if (c.quote === "pending") out.push({ key: "quote_pending", label: "Quote permission pending", tone: "warn" });
  if (c.quote === "none") out.push({ key: "quote_none", label: "No quote permission", tone: "bad" });
  if (!c.activity) out.push({ key: "activity", label: "No investor activity recorded", tone: "warn" });
  return out;
}

export function isFullyProven(c: ProofCompany): boolean {
  return missingFor(c).length === 0;
}

export type ProofStats = {
  total: number;
  measured: number;
  avg: number | null;
  median: number | null;
  minMonths: number;
  maxMonths: number;
  /** Companies at or past the outreach gate now, and at their first score. */
  gateNow: number;
  gateFirst: number;
  bandsFirst: Record<Band, number>;
  bandsNow: Record<Band, number>;
  quoteYes: number;
  withActivity: number;
  meetings: number;
  conversations: number;
  intros: number;
  fullyProven: number;
  needs: Array<{ company: ProofCompany; missing: Missing[] }>;
};

const emptyBands = (): Record<Band, number> => ({ Early: 0, Developing: 0, Solid: 0, Strong: 0 });

export function proofStats(list: ProofCompany[], gate: number): ProofStats {
  const m = list.filter(isMeasured);
  const deltas = m.map((c) => changeOf(c) as number).sort((a, b) => a - b);
  const n = deltas.length;
  const avg = n ? Math.round((deltas.reduce((s, v) => s + v, 0) / n) * 10) / 10 : null;
  const median = n ? (n % 2 ? deltas[(n - 1) / 2] : (deltas[n / 2 - 1] + deltas[n / 2]) / 2) : null;
  const months = m.map(monthsOf);

  const bandsFirst = emptyBands();
  const bandsNow = emptyBands();
  for (const c of list) {
    if (c.first) bandsFirst[c.first.band] += 1;
    if (c.latest) bandsNow[c.latest.band] += 1;
  }

  const act = list.filter((c) => c.activity);
  const sum = (k: keyof ProofActivity) => act.reduce((s, c) => s + (c.activity?.[k] ?? 0), 0);

  return {
    total: list.length,
    measured: n,
    avg,
    median,
    minMonths: months.length ? Math.min(...months) : 0,
    maxMonths: months.length ? Math.max(...months) : 0,
    gateNow: list.filter((c) => (c.latest?.score ?? -1) >= gate).length,
    gateFirst: list.filter((c) => (c.first?.score ?? -1) >= gate).length,
    bandsFirst,
    bandsNow,
    quoteYes: list.filter((c) => c.quote === "yes").length,
    withActivity: act.length,
    meetings: sum("meetings"),
    conversations: sum("conversations"),
    intros: sum("intros"),
    fullyProven: list.filter(isFullyProven).length,
    needs: list
      .map((company) => ({ company, missing: missingFor(company) }))
      .filter((x) => x.missing.length > 0)
      .sort((a, b) => b.missing.length - a.missing.length || a.company.companyName.localeCompare(b.company.companyName)),
  };
}

/** The one sentence you can state today, from measured data only. */
export function statementOf(s: ProofStats): string {
  if (!s.measured || s.avg === null) return "No founder has a measured before and after yet, so no change can be stated.";
  const span = s.minMonths === s.maxMonths ? monthsLabel(s.maxMonths) : `${s.minMonths} to ${monthsLabel(s.maxMonths)}`;
  return `${s.measured} founder${s.measured === 1 ? "" : "s"}, measured over ${span}, average CRR change ${signed(s.avg)} points.`;
}

export type Claim = { claim: string; evidence: string; ok: boolean; action: string; tone: "bad" | "warn" };

/** Every claim in the announcement, and whether the platform can prove it today. */
export function claimsFor(c: ProofCompany): Claim[] {
  const measured = isMeasured(c);
  const d = changeOf(c);
  const mo = monthsLabel(monthsOf(c));
  const a = c.activity;
  return [
    {
      claim: measured ? `Before and after CRR measured: ${c.first!.score} to ${c.latest!.score}` : "Before and after CRR measured",
      evidence: "Score history, first and latest score under the active weighting.",
      ok: measured,
      tone: "bad",
      action: measured ? "Keep the dates with each score." : "Re-score after the next document upload to create a second point, or cut the claim.",
    },
    {
      claim: measured && d !== null ? `CRR change of ${signed(d)} points over ${mo}` : "CRR change over time",
      evidence: "Computed from the first and latest score.",
      ok: measured,
      tone: "bad",
      action: measured ? `State the population: 1 founder over ${mo}.` : "No change can be stated yet.",
    },
    {
      claim: "Founder agreed to be quoted",
      evidence: "Consent timestamp on an approved testimonial.",
      ok: c.quote === "yes",
      tone: "warn",
      action: c.quote === "yes" ? "Ready to quote." : c.quote === "pending" ? "Submission is pending review. Approve it or cut the quote claim." : "No yes on file. Request it or cut the quote claim.",
    },
    {
      claim: a ? `${a.meetings} meetings, ${a.conversations} conversations, ${a.intros} intro requests recorded` : "Investor activity recorded",
      evidence: "Platform records: accepted or scheduled meetings, outreach conversations, intro requests.",
      ok: !!a,
      tone: "warn",
      action: a ? "Ready to cite as platform records." : "Nothing recorded. Only state what the platform holds.",
    },
  ];
}

/** The draft announcement for one company. States what was measured, nothing more. */
export function announcementFor(c: ProofCompany): string {
  if (!isMeasured(c)) {
    return `${c.companyName} has ${c.latest ? `one CRR score so far (${c.latest.score})` : "no CRR score yet"}. A before and after is needed to build the announcement.`;
  }
  const d = changeOf(c) as number;
  const parts = [
    `${c.companyName} raised its Capital Readiness Rating from ${c.first!.score} to ${c.latest!.score}, a change of ${signed(d)} points over ${monthsLabel(monthsOf(c))}.`,
  ];
  if (c.quote === "yes") parts.push("The founder agreed to be quoted.");
  if (c.activity) {
    parts.push(`The platform recorded ${c.activity.meetings} investor meetings, ${c.activity.conversations} active conversations and ${c.activity.intros} intro requests.`);
  } else {
    parts.push("No investor activity has been recorded yet.");
  }
  return parts.join(" ");
}

const HOW_TO_READ =
  "How to read it: CRR (Capital Readiness Rating) scores how ready a founder is to raise across narrative, team, financials, traction and cap table. The figures show what we measured. They do not claim that iCapOS caused any funding outcome.";

const SIGN_OFF = ["Happy to walk you through the detail or share the demo link.", "", "Best regards,"];

/** Subject and body for the share by email draft. One company, or the group in view. */
export function emailFor(company: ProofCompany | null, stats: ProofStats, signature: string[]): { subject: string; body: string } {
  const tail = [...SIGN_OFF, ...signature];
  if (company) {
    const measured = isMeasured(company);
    const d = changeOf(company);
    const a = company.activity;
    return {
      subject: measured && company.first && company.latest
        ? `Founder CRR proof report: ${company.companyName}, ${company.first.score} to ${company.latest.score}`
        : `Founder CRR proof report: ${company.companyName}`,
      body: [
        "Hello [Name],",
        "",
        measured ? `Attached is our Founder CRR proof report for ${company.companyName}, measured over ${monthsLabel(monthsOf(company))}.` : `Attached is our Founder CRR proof report for ${company.companyName}.`,
        "",
        "Key figures:",
        `• CRR before and now: ${company.first ? company.first.score : "n/a"} to ${company.latest ? company.latest.score : "n/a"}`,
        `• Change: ${d === null ? "n/a" : `${signed(d)} points`}`,
        a ? `• Platform records: ${a.meetings} meetings, ${a.conversations} outreach conversations, ${a.intros} intro requests` : "• Investor activity: none recorded yet",
        "",
        HOW_TO_READ,
        "",
        ...tail,
      ].join("\n"),
    };
  }
  return {
    subject: stats.measured && stats.avg !== null ? `Founder CRR proof summary: ${stats.measured} founders, average change ${signed(stats.avg)} points` : "Founder CRR proof summary",
    body: [
      "Hello [Name],",
      "",
      stats.measured ? `Attached is our Founder CRR proof summary for ${stats.measured} founders.` : "Attached is our Founder CRR proof summary.",
      "",
      "Key figures:",
      `• Founders with a measured before and after CRR: ${stats.measured} of ${stats.total}`,
      `• Average CRR change: ${stats.avg === null ? "n/a" : `${signed(stats.avg)} points (median ${signed(stats.median as number)})`}`,
      stats.withActivity ? `• Platform records for ${stats.withActivity} founders: ${stats.meetings} meetings, ${stats.conversations} outreach conversations, ${stats.intros} intro requests` : "• Investor activity: none recorded yet",
      "",
      HOW_TO_READ,
      "",
      ...tail,
    ].join("\n"),
  };
}

/** Rows for the CSV export: one per company. */
export const CSV_HEADER = ["Company", "Founder", "Stage", "CRR first", "CRR latest", "Change", "Months", "Quote permission", "Meetings", "Conversations", "Intro requests"];

export function csvRow(c: ProofCompany): Array<string | number> {
  const d = changeOf(c);
  return [
    c.companyName,
    c.founderName ?? c.founderEmail ?? "",
    c.profileLabel,
    c.first?.score ?? "",
    c.latest?.score ?? "",
    d ?? "",
    isMeasured(c) ? monthsOf(c) : "",
    c.quote,
    c.activity?.meetings ?? "",
    c.activity?.conversations ?? "",
    c.activity?.intros ?? "",
  ];
}
