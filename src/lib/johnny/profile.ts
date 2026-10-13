/**
 * Johnny's investor profile: the five fields he asks about, read out of whatever
 * the investor types or taps, in any order. Pure functions, no I/O, so the page,
 * the API route and the tests all share one definition.
 *
 * Field names follow investor_profiles: investor_type, check_size_min,
 * check_size_max, preferred_sectors ("Industry"), preferred_stages, capital_types.
 */

import { INVESTOR_TYPES as PROFILE_INVESTOR_TYPES } from "@/lib/investor/types";
import { CODE_FALLBACK } from "@/lib/vocabulary/lists";

/**
 * Every option Johnny offers is a value the investor profile form already uses,
 * so what he collects drops straight into investor_profiles:
 * investor type from INVESTOR_TYPES (stored value via investorTypeValue), stages,
 * capital types and industries from the platform vocabulary labels.
 */
export const INVESTOR_TYPES: string[] = PROFILE_INVESTOR_TYPES.map((t) => t.label);
export const STAGES: string[] = CODE_FALLBACK.funding_stage.filter((o) => o.slug !== "other").map((o) => o.label);
export const CAPITAL_TYPES: string[] = CODE_FALLBACK.capital_type.map((o) => o.label);
/** The field's own catch all. On industry, stage and capital type it asks the investor to type the answer. */
export const OTHER = "Other";
/** The stored investor_type value for a label Johnny collected. */
export const investorTypeValue = (label: string | undefined): string | null => PROFILE_INVESTOR_TYPES.find((t) => t.label === label)?.value ?? null;

export type FieldKey = "type" | "sect" | "check" | "stage" | "cap";
/** Order Johnny asks in when something is missing. */
export const FIELD_ORDER: FieldKey[] = ["type", "sect", "check", "stage", "cap"];

export interface InvestorProfile {
  type?: string;
  cmin?: number;
  cmax?: number;
  sect: string[];
  stage: string[];
  cap: string[];
  /** investment_thesis: what would make a deal worth a look, asked after a second no. */
  thesis?: string;
  /** The investor said Johnny may reach out when a fit comes up. */
  followUp?: boolean;
}

export const emptyProfile = (): InvestorProfile => ({ sect: [], stage: [], cap: [] });

/**
 * Free text to industry labels from the vocabulary table (industry list), the
 * way Jessica 2.0 reads industries: keyword rules, most specific first.
 */
const SECTORS: Array<[RegExp, string]> = [
  [/enterprise software/, "Enterprise Software"],
  [/b2b (software|saas)/, "SaaS / B2B Software"],
  [/\bsaas\b/, "SaaS"],
  [/software|\bapps?\b|platform/, "Software"],
  [/artificial intelligence|\bai\b|a\.i\.|machine learning|\bml\b|\bllm/, "AI / ML"],
  [/cyber|security/, "Cyber Security"],
  [/blockchain|web3|defi/, "Blockchain"],
  [/crypto/, "Cryptocurrency"],
  [/bitcoin/, "Bitcoin"],
  [/fin ?tech|payments?\b|neobank/, "Fintech"],
  [/insur/, "Insurance"],
  [/financial services|wealth|lending|\bbank/, "Financial Services"],
  [/digital health|telehealth/, "Digital Health"],
  [/medical device|med ?tech/, "Medical Devices"],
  [/bio|pharma|life science|therapeut|drug/, "Biotechnology/Life Science"],
  [/healthtech/, "HealthTech"],
  [/wellness/, "Health & Wellness"],
  [/health|clinic|hospital|medical|\bcare\b/, "Healthcare"],
  [/clean|climate|renewable|solar|\bwind\b|sustainab/, "Cleantech"],
  [/\boil\b|\bgas\b/, "Oil & Gas"],
  [/energy|nuclear|battery|batteries/, "Energy"],
  [/mining/, "Mining"],
  [/\biot\b|\bdata\b/, "Data/IoT"],
  [/deep ?tech/, "Deep Tech"],
  [/robot/, "Robotics"],
  [/semiconductor|\bchips?\b/, "Semiconductor"],
  [/hardware|drone/, "Hardware"],
  [/aero|space/, "Aerospace"],
  [/defen[cs]e/, "Defense"],
  [/telecom|\b5g\b|wireless/, "Telecom"],
  [/logistic|supply chain|shipping|freight/, "Logistics"],
  [/transport|mobility/, "Transportation"],
  [/warehous/, "Warehousing"],
  [/manufactur|factory/, "Manufacturing"],
  [/industrial/, "Industrial"],
  [/construction/, "Construction"],
  [/materials/, "Materials"],
  [/agtech|ag tech/, "AgTech"],
  [/agri|farm|crop/, "Agriculture"],
  [/food ?tech/, "Food Tech"],
  [/food|restaurant|beverage|hospitality|hotel/, "Food/Hospitality"],
  [/apparel|fashion|clothing|footwear/, "Apparel"],
  [/e ?-?commerce|online store|\bdtc\b/, "E-commerce"],
  [/marketplace/, "Marketplace"],
  [/gaming|\bgames?\b/, "Gaming"],
  [/media|film|music|streaming/, "Media"],
  [/entertainment/, "Entertainment"],
  [/\bedtech|education|school/, "EdTech"],
  [/travel|tourism/, "Travel"],
  [/cannabis|\bcbd\b/, "Cannabis"],
  [/real estate|property|proptech|housing/, "Real Estate"],
  [/professional services|consult|staffing|recruit/, "Professional Services"],
  [/business services|b2b services/, "Business Services"],
  [/consumer|retail|\bcpg\b|beauty|cosmetic|\bpets?\b/, "Consumer Products"],
  [/communications/, "Communications"],
  [/plastic/, "Plastics"],
  [/nano/, "Nano Technology"],
];

/** Industry labels read out of free text. Software gives way to the more specific software labels. */
export function industriesIn(text: string): string[] {
  const l = text.toLowerCase();
  // In the order the investor said them.
  const hits = SECTORS.map(([re, name]) => ({ name, at: l.search(re) })).filter((h) => h.at >= 0).sort((a, b) => a.at - b.at);
  let found = [...new Set(hits.map((h) => h.name))];
  if (found.some((n) => n === "Enterprise Software" || n === "SaaS / B2B Software" || n === "SaaS")) found = found.filter((n) => n !== "Software");
  if (found.includes("SaaS / B2B Software")) found = found.filter((n) => n !== "SaaS");
  return found;
}

export const CHECK_BUCKETS: Record<string, [number, number]> = {
  "Under $250K": [0, 250_000],
  "$250K to $1M": [250_000, 1_000_000],
  "$1M to $5M": [1_000_000, 5_000_000],
  "$5M to $25M": [5_000_000, 25_000_000],
  "$25M or more": [25_000_000, 1e10],
};

export const OPTIONS: Record<FieldKey, string[]> = {
  type: [...INVESTOR_TYPES],
  check: [...Object.keys(CHECK_BUCKETS)],
  sect: ["Software", "SaaS / B2B Software", "Healthcare", "Fintech", "AI / ML", "Consumer Products", "Cleantech", "Enterprise Software", "Biotechnology/Life Science", "Real Estate", OTHER],
  stage: [...STAGES, OTHER],
  cap: [...CAPITAL_TYPES, OTHER],
};

function trim2(x: number) {
  return String(Math.round(x * 100) / 100);
}
export function formatMoney(n: number): string {
  return n >= 1e6 ? `$${trim2(n / 1e6)}M` : n >= 1e3 ? `$${trim2(n / 1e3)}K` : `$${n}`;
}
export function formatRange(p: Pick<InvestorProfile, "cmin" | "cmax">): string {
  const { cmin, cmax } = p;
  if (cmin == null || cmax == null) return "";
  if (cmin === 0) return `under ${formatMoney(cmax)}`;
  if (cmax >= 1e10) return `${formatMoney(cmin)} or more`;
  return cmin === cmax ? formatMoney(cmin) : `${formatMoney(cmin)} to ${formatMoney(cmax)}`;
}

function extractType(l: string): string | null {
  const [individual, group, family, fund, corporate, other] = INVESTOR_TYPES;
  if (/angel group|syndicate|angel network/.test(l)) return group;
  if (/angel|individual|on my own|personal(ly)?/.test(l)) return individual;
  if (/family office/.test(l)) return family;
  if (/\bvc\b|venture capital|venture fund|venture firm|\bfund\b|private equity|\bpe\b/.test(l)) return fund;
  if (/corporate|strategic|\bcvc\b/.test(l)) return corporate;
  if (/\bbank|lender|lending|hedge/.test(l)) return other;
  return null;
}

/** Dollar amounts in a sentence: "50k to 100k", "$1.5 million", "500,000". Years, counts and percentages are ignored. */
export function extractAmounts(text: string): number[] {
  const l = text.toLowerCase().replace(/,/g, "");
  const re = /\$?\s?(\d+(?:\.\d+)?)\s*(k|mm|mil|million|m|thousand|bn|billion|b)?\b(?!\s*(?:years?|yrs?|months?|days?|companies|investors|deals|percent|%))/g;
  const found: Array<{ n: number; u: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(l))) found.push({ n: parseFloat(m[1]), u: m[2] ?? "" });
  for (let i = found.length - 2; i >= 0; i--) if (!found[i].u && found[i + 1].u && found[i].n <= 1000) found[i].u = found[i + 1].u;
  const out: number[] = [];
  for (const x of found) {
    const mult = /^(k|thousand)$/.test(x.u) ? 1e3 : /^(m|mm|mil|million)$/.test(x.u) ? 1e6 : /^(b|bn|billion)$/.test(x.u) ? 1e9 : 1;
    const v = x.n * mult;
    if (v >= 1000 && v <= 1e10) out.push(v);
  }
  return out;
}

const WANTS_ANY = /\b(all|any|anything|everything|open|no preference|whatever)\b/;

/** Read a typed message into the profile. Returns the fields that changed. `asked` lets "all" answer the question just asked. */
export function extractFields(p: InvestorProfile, text: string, asked: FieldKey | null): FieldKey[] {
  const l = text.toLowerCase();
  const changed: FieldKey[] = [];
  // An answer already given only changes on a direct answer to that question or a clear correction.
  const fix = /\b(actually|correction|rather|instead|sorry|i meant)\b/.test(l);
  const type = extractType(l);
  if (type && type !== p.type && (!p.type || asked === "type" || fix)) {
    p.type = type;
    changed.push("type");
  }
  const a = extractAmounts(text);
  if (a.length && (p.cmin == null || asked === "check" || fix)) {
    const mn = Math.min(...a);
    const mx = Math.max(...a);
    if (mn !== p.cmin || mx !== p.cmax) {
      p.cmin = mn;
      p.cmax = mx;
      changed.push("check");
    }
  }
  const anySect = /agnostic|generalist|any (industry|sector)|all (industries|sectors)|open to (anything|all|everything)/.test(l) || (asked === "sect" && WANTS_ANY.test(l));
  if (anySect) {
    if (!p.sect.includes(OTHER)) {
      p.sect.push(OTHER);
      changed.push("sect");
    }
  } else {
    for (const name of industriesIn(text)) {
      if (!p.sect.includes(name)) {
        p.sect.push(name);
        if (!changed.includes("sect")) changed.push("sect");
      }
    }
  }
  const ls = l.replace(/pre[- ]?seed/g, " PRESEED ");
  const anyStage = /any stage|stage agnostic|all stages|every stage/.test(l) || (asked === "stage" && WANTS_ANY.test(l));
  if (anyStage) {
    if (!p.stage.includes(OTHER)) {
      p.stage.push(OTHER);
      changed.push("stage");
    }
  } else {
    const st: string[] = [];
    if (/PRESEED/.test(ls)) st.push("Pre-seed");
    if (/\bseed\b/.test(ls)) st.push("Seed");
    if (/series a|\ba round\b/.test(ls)) st.push("Series A");
    if (/series b|\bb round\b/.test(ls)) st.push("Series B");
    if (/series [c-z]|growth|late stage|expansion/.test(ls)) st.push("Growth");
    if (/early stage|early-stage/.test(ls)) st.push("Pre-seed", "Seed");
    for (const x of st) {
      if (!p.stage.includes(x)) {
        p.stage.push(x);
        if (!changed.includes("stage")) changed.push("stage");
      }
    }
  }
  let cp: string[] = [];
  if (/equity|ownership|stake|preferred stock/.test(l)) cp.push("Equity");
  if (/\bsafes?\b/.test(l)) cp.push("SAFE");
  if (/convertible|\bnote\b/.test(l)) cp.push("Convertible note");
  if (/venture debt|\bdebt\b|loan|lend|credit/.test(l)) cp.push("Venture debt");
  if (/revenue[- ]based|\brbf\b|royalt/.test(l)) cp.push("Revenue-based");
  if (/all (types|of the above|of these|three)|every type|everything/.test(l) || (asked === "cap" && WANTS_ANY.test(l))) cp = [...CAPITAL_TYPES];
  for (const x of cp) {
    if (!p.cap.includes(x)) {
      p.cap.push(x);
      if (!changed.includes("cap")) changed.push("cap");
    }
  }
  return changed;
}

/** Apply a tapped option. */
export function applyOption(p: InvestorProfile, field: FieldKey, option: string): void {
  if (field === "type") p.type = option;
  else if (field === "check") {
    const b = CHECK_BUCKETS[option];
    if (b) [p.cmin, p.cmax] = b;
  } else if (field === "sect") {
    if (!p.sect.includes(option)) p.sect.push(option);
  } else if (field === "stage") {
    if (!p.stage.includes(option)) p.stage.push(option);
  } else if (field === "cap") {
    if (!p.cap.includes(option)) p.cap.push(option);
  }
}

/** A typed answer to "Other": kept as given, the way the signup form keeps values that are not on its list. */
export function applyOtherText(p: InvestorProfile, field: "sect" | "stage" | "cap", text: string): boolean {
  const t = text.trim().replace(/\s+/g, " ").slice(0, 40);
  // A question or a request is never stored as a value.
  if (!t || /\?/.test(t) || t.split(" ").length > 4) return false;
  if (/\b(you|your|me|info|send|about|please|what|how|why|who)\b/i.test(t)) return false;
  const value = t.replace(/\b\w/g, (c) => c.toUpperCase());
  if (!p[field].includes(value)) p[field].push(value);
  return true;
}

export function missingFields(p: InvestorProfile): FieldKey[] {
  const m: FieldKey[] = [];
  if (!p.type) m.push("type");
  if (!p.sect.length) m.push("sect");
  if (p.cmin == null) m.push("check");
  if (!p.stage.length) m.push("stage");
  if (!p.cap.length) m.push("cap");
  return m;
}

export const hasAnything = (p: InvestorProfile) => Boolean(p.type) || p.cmin != null || p.sect.length > 0 || p.stage.length > 0 || p.cap.length > 0;

/** The read back, one short sentence per known field. */
export function summaryLines(p: InvestorProfile): string[] {
  const out: string[] = [];
  if (p.type) out.push(`${p.type}.`);
  if (p.cmin != null) out.push(`Checks of ${formatRange(p)}.`);
  if (p.sect.length) out.push(`${p.sect.join(", ")}.`);
  if (p.stage.length) out.push(`${p.stage.join(", ")}.`);
  if (p.cap.length) out.push(`${p.cap.join(", ")}.`);
  return out;
}

/** "checks under $250K", "checks of $1M to $5M". */
export function checksPhrase(p: Pick<InvestorProfile, "cmin" | "cmax">): string {
  return p.cmin === 0 ? `checks ${formatRange(p)}` : `checks of ${formatRange(p)}`;
}

/** The read back in one line, the way Jessica 2.0 does it: "So: family office, checks of $1M, fintech." */
export function summaryLine(p: InvestorProfile): string {
  const parts: string[] = [];
  if (p.type) parts.push(p.type);
  if (p.cmin != null) parts.push(checksPhrase(p));
  if (p.sect.length) parts.push(p.sect.join(" and "));
  if (p.stage.length) parts.push(p.stage.join(" and "));
  if (p.cap.length) parts.push(p.cap.join(" and "));
  return `So: ${parts.join(", ")}.`;
}

/** "2", "$5", "1.5" with no unit, typed for a check size: the number to check with the investor ("2 million?"). */
export function bareNumber(text: string): string | null {
  const t = text.trim();
  if (!/^\$?\s*\d+(\.\d+)?\s*$/.test(t)) return null;
  const n = t.replace(/[^\d.]/g, "");
  return parseFloat(n) < 1000 ? n : null;
}

/** The profile as booking answers, so the team sees it on the invite. */
export function profileAnswers(p: InvestorProfile): Array<{ label: string; value: string }> {
  const rows: Array<[string, string | undefined]> = [
    ["Investor type", p.type],
    ["investor_type value", investorTypeValue(p.type) ?? undefined],
    ["Check size", p.cmin != null ? formatRange(p) : undefined],
    ["Industry", p.sect.join(", ")],
    ["Stages", p.stage.join(", ")],
    ["Capital types", p.cap.join(", ")],
    ["Investment thesis", p.thesis],
    ["Follow up", p.followUp ? "May reach out when a fit comes up" : undefined],
  ];
  return rows.filter((r): r is [string, string] => Boolean(r[1]?.trim())).map(([label, value]) => ({ label, value: value.slice(0, 1000) }));
}

/* ---------- the AI reply, checked before anyone sees it ---------- */

export interface JohnnyAiReply {
  lines: string[];
  fields: { type?: string; cmin?: number; cmax?: number; sect: string[]; stage: string[]; cap: string[] };
  ask: "none" | "investor_type" | "check_size" | "preferred_sectors" | "preferred_stages" | "capital_types";
  ready: boolean;
}

const ASKS = ["none", "investor_type", "check_size", "preferred_sectors", "preferred_stages", "capital_types"];
export const ASK_TO_FIELD: Record<string, FieldKey> = { investor_type: "type", check_size: "check", preferred_sectors: "sect", preferred_stages: "stage", capital_types: "cap" };
const BANNED = /%|percent|—|–| - |as an ai|language model|i'?m an ai/i;

/**
 * Accept the model's JSON or refuse it. Dollar figures may only repeat what the
 * visitor said (`allowedMoney`, already lower cased with spaces and commas removed).
 */
export function parseJohnnyReply(data: unknown, allowedMoney: string, visitorText: string): JohnnyAiReply | null {
  if (!data || typeof data !== "object") return null;
  const r = data as Record<string, unknown>;
  if (!Array.isArray(r.lines)) return null;
  const lines = r.lines.map((x) => String(x).trim().slice(0, 170)).filter(Boolean).slice(0, 2);
  if (!lines.length) return null;
  for (const s of lines) {
    if (BANNED.test(s)) return null;
    for (const m of s.match(/\$\s?\d[\d,.]*\s?(?:k|m|million|thousand)?/gi) ?? []) {
      if (!allowedMoney.replace(/\$/g, "").includes(m.toLowerCase().replace(/[\s$,]/g, ""))) return null;
    }
  }
  const f = (r.fields && typeof r.fields === "object" ? r.fields : {}) as Record<string, unknown>;
  const arr = (x: unknown): string[] => (Array.isArray(x) ? x.map(String) : []);
  const out: JohnnyAiReply["fields"] = {
    sect: arr(f.preferred_sectors).map((x) => x.trim()).filter((x) => x && x.length <= 40 && !/\d/.test(x)).slice(0, 6),
    stage: arr(f.preferred_stages).filter((x) => STAGES.includes(x)),
    cap: arr(f.capital_types).filter((x) => CAPITAL_TYPES.includes(x)),
  };
  if (typeof f.investor_type === "string" && INVESTOR_TYPES.includes(f.investor_type)) out.type = f.investor_type;
  const a = Number(f.check_size_min);
  const b = Number(f.check_size_max);
  if (a >= 1000 && b >= 1000 && a <= 1e10 && b <= 1e10 && /\d/.test(visitorText)) {
    out.cmin = Math.min(a, b);
    out.cmax = Math.max(a, b);
  }
  const ask = ASKS.includes(String(r.ask)) ? (String(r.ask) as JohnnyAiReply["ask"]) : "none";
  return { lines, fields: out, ask, ready: r.ready === true };
}

/** Fold validated AI fields into the profile. Typed and tapped answers always win over the model. */
export function mergeAiFields(p: InvestorProfile, f: JohnnyAiReply["fields"]) {
  if (f.type && !p.type) p.type = f.type;
  if (f.cmin != null && f.cmax != null && p.cmin == null) {
    p.cmin = f.cmin;
    p.cmax = f.cmax;
  }
  for (const x of f.sect ?? []) if (!p.sect.includes(x)) p.sect.push(x);
  for (const x of f.stage ?? []) if (!p.stage.includes(x)) p.stage.push(x);
  for (const x of f.cap ?? []) if (!p.cap.includes(x)) p.cap.push(x);
}
