/**
 * AI enrichment for investor contacts missing matching data (industry / type / stage).
 * Proposals are stored in investor_enrichment for review; on approval they're written
 * to crm_contacts.overrides with inv_source='inferred' — never overwriting verified or
 * self_reported data. Check size / revenue are intentionally NOT guessed.
 *
 * Stage is the investor's THESIS (the stage of company they fund), which firms state
 * publicly — so it is EXTRACTED from stated text only and left empty otherwise. A wrong
 * stage actively mis-ranks an investor; a missing one simply doesn't score.
 *
 * Server-only, except the pure parseProposal / normalizeStages (unit-tested).
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { readAllRows, chunk } from "@/lib/supabase/paged";
import { reindexContacts } from "@/lib/fit/match-index";
import { claudeComplete, isClaudeConfigured, CLAUDE_HAIKU } from "@/lib/claude";
import { canonicalizeIndustries } from "@/lib/industries/canonical";
import { OP_STAGE_LABEL, OP_STAGE_LABELS, canonicalInvestorType, INVESTOR_TYPE_VOCAB } from "@/lib/fit/options";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

/**
 * The only stage values the matcher compares against (Odoo operating-stage spellings,
 * mirrored by Q1_STAGE in ./options). Anything outside this set is dropped rather than
 * stored, so an approved proposal can never write a value that silently never matches.
 */
export const STAGE_VOCAB = [
  "Startup", "Prototype",
  "Expand Growth", "Small Business",
  "Midsize Company", "Large Corporation", "Large Company",
] as const;

/** Keep only exact vocabulary values (case-insensitively), deduped and in vocab order. */
export function normalizeStages(values: unknown): string[] {
  const list = Array.isArray(values) ? values : values == null ? [] : [values];
  const seen = new Set(list.map((v) => String(v).trim().toLowerCase()).filter(Boolean));
  return STAGE_VOCAB.filter((v) => seen.has(v.toLowerCase()));
}

export type Proposal = { industries: string[]; investorType: string | null; stages: string[]; confidence: number; rationale: string };

/** Parse Claude's reply into a validated Proposal. Pure + tolerant of prose/fences. */
export function parseProposal(text: string): Proposal | null {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/); // first {...} block
  if (!m) return null;
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(m[0]); } catch { return null; }
  const industries = Array.isArray(raw.industries)
    ? raw.industries.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const t = raw.investorType ?? raw.investor_type ?? raw.type;
  // Clamped to a canonical spelling for the same reason stages are: an off-vocabulary
  // value ("Corporate VC") would be stored and then never match any founder answer.
  const investorType = typeof t === "string" && !/^\s*(unknown|n\/a|none)\s*$/i.test(t) ? canonicalInvestorType(t) : null;
  let confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.max(0, Math.min(100, Math.round(confidence)));
  const rationale = typeof raw.rationale === "string" ? raw.rationale.slice(0, 300) : "";
  const stages = normalizeStages(raw.stages ?? raw.stage);
  return { industries, investorType, stages, confidence, rationale };
}

const SYSTEM = [
  "You classify an investment firm from limited signals (company name, email domain, and sometimes website text).",
  "Return STRICT JSON only, no prose: {\"industries\": string[], \"investorType\": string|null, \"stages\": string[], \"confidence\": 0-100, \"rationale\": string}.",
  "industries = the sectors this investor most likely funds (e.g. 'Fintech','SaaS','Healthcare','Real Estate','Deep Tech'); [] if you truly cannot tell.",
  `investorType = EXACTLY one of: ${INVESTOR_TYPE_VOCAB.map((t) => `'${t}'`).join(", ")}, or null if unclear.`,
  // Stage is EXTRACTED, not inferred — see the module header. The vocabulary is closed so
  // the value lands on something the matcher actually compares.
  "stages = the stage of company this investor's thesis targets, using ONLY these exact values:",
  `${STAGE_VOCAB.join(" | ")}.`,
  "Map stated language onto them: pre-seed/seed/idea/first-cheque -> 'Startup' and/or 'Prototype';",
  "post-seed/early-revenue/Series A -> 'Expand Growth' and/or 'Small Business';",
  "growth equity/Series B+/later-stage/buyout -> 'Midsize Company' and/or 'Large Corporation'.",
  "A thesis may span two bands ('seed to Series A') — return both.",
  "CRITICAL: return stages ONLY when the provided text explicitly states the stage(s) they invest at.",
  "If the stage is not stated, return [] — do NOT reason from the firm's type, name, or size. A wrong stage is far worse than no stage.",
  "In rationale, when you return stages, quote the phrase you took them from.",
  "confidence reflects how sure you are overall. Be conservative: a generic holding-company name is low confidence. Never invent a sector or a stage to be helpful.",
].join(" ");

type InvestorRow = { id: string; company: string | null; email: string | null; raw: Record<string, unknown> | null; overrides: Record<string, unknown> | null; inv_source: string | null };

function domainOf(email: string | null): string | null {
  if (!email || !email.includes("@")) return null;
  return email.split("@")[1].trim().toLowerCase() || null;
}
// Generic mailbox domains carry no company signal — don't fetch a "website" for them.
const GENERIC_DOMAINS = new Set(["gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com", "proton.me", "protonmail.com"]);

/** Strip one page to plain text. Null on any failure (bad status, timeout, non-HTML). */
async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(4000), headers: { "user-agent": "iCapOS-enrichment/1.0" } });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 40000);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text || null;
  } catch { return null; }
}

// A firm's stage thesis is usually on /about or /portfolio rather than the homepage, so
// all three are fetched CONCURRENTLY — same wall-clock cost as the single homepage fetch,
// which matters because the batch runs inside a 60s serverless limit.
const SITE_PATHS = ["", "/about", "/portfolio"];

/** Best-effort site text for a domain (timeout + size capped). Null when nothing loads. */
async function fetchSiteText(domain: string | null): Promise<string | null> {
  if (!domain || GENERIC_DOMAINS.has(domain)) return null;
  const parts = await Promise.all(SITE_PATHS.map((p) => fetchPageText(`https://${domain}${p}`)));
  const text = parts.filter(Boolean).join(" \n ").replace(/\s+/g, " ").trim().slice(0, 3000);
  return text || null;
}
function hasIndustry(r: InvestorRow): boolean {
  const ov = r.overrides?.["Industries"];
  if (Array.isArray(ov) && ov.length) return true;
  const raw = (r.raw?.__profile as { industries?: unknown } | undefined)?.industries;
  return Array.isArray(raw) && raw.length > 0;
}
function hasType(r: InvestorRow): boolean {
  const ov = r.overrides?.["Investor type"];
  if (Array.isArray(ov) && ov.length) return true;
  const raw = (r.raw?.__profile as { investorTypes?: unknown } | undefined)?.investorTypes;
  return Array.isArray(raw) && raw.length > 0;
}
// Mirrors how the matcher reads stage: overrides win over the Odoo-synced questionnaire.
function hasStage(r: InvestorRow): boolean {
  // Checks BOTH stage labels (see OP_STAGE_LABELS): a contact whose stage sits under the
  // investor-side phrasing already has one, and must not be queued for enrichment.
  return OP_STAGE_LABELS.some((label) => hasStageUnder(r, label));
}
function hasStageUnder(r: InvestorRow, OP_STAGE_LABEL: string): boolean {
  const ov = r.overrides?.[OP_STAGE_LABEL];
  if (Array.isArray(ov) && ov.length) return true;
  const extra = (r.raw?.__profile as { extra?: Record<string, unknown> } | undefined)?.extra;
  const v = extra?.[OP_STAGE_LABEL];
  return Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim() !== "";
}

/**
 * Raised when the AI itself is unreachable (no key, no credits, API error) — as opposed
 * to the AI running and finding nothing. The two used to be indistinguishable, so an
 * outage silently marked every contact 'rejected' and permanently removed it from the
 * candidate pool. A run must abort on this, never record it as a result.
 */
export class ClaudeUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = "ClaudeUnavailableError"; }
}

/** Propose enrichment for one investor via Claude. Null = ran, found nothing usable. */
export async function proposeFor(row: InvestorRow): Promise<(Proposal & { basis: string }) | null> {
  if (!isClaudeConfigured()) throw new ClaudeUnavailableError("Claude is not configured (no API key).");
  const domain = domainOf(row.email);
  const site = await fetchSiteText(domain);
  const basis = site ? "website" : domain ? "domain" : "name";
  const user = [
    `Company: ${row.company ?? "(unknown)"}`,
    `Email domain: ${domain ?? "(none)"}`,
    site ? `Website text (excerpt): ${site}` : null,
  ].filter(Boolean).join("\n");
  let reply: string;
  try {
    reply = await claudeComplete([{ role: "user", content: user }], { model: CLAUDE_HAIKU, system: SYSTEM, maxTokens: 300, temperature: 0 });
  } catch (e) {
    // The call itself failed — out of credits, rate limited, network. Not a verdict.
    throw new ClaudeUnavailableError(e instanceof Error ? e.message.slice(0, 200) : "Claude request failed.");
  }
  const p = parseProposal(reply);           // null here DOES mean "nothing usable"
  if (!p) return null;
  return { ...p, industries: canonicalizeIndustries(p.industries), basis };
}

/** Run a capped batch: propose for investors missing industry or type, store as pending. */
export async function runEnrichment(limit = 40): Promise<{ scanned: number; proposed: number; skipped: number; remaining: number; unavailable: string | null }> {
  // IDS ONLY. This used to select the full row — including the fat Odoo `raw` jsonb —
  // for every investor, on EVERY batch. A "run all" of ~50 batches therefore parsed the
  // whole network ~50 times over, which is what pinned the database CPU at 97%.
  // Selecting just the id keeps this pass nearly free; the wide read below is limited to
  // the handful of contacts actually being processed.
  const allIds = await readAllRows<{ id: string }>((from, to) => db().from("crm_contacts")
    .select("id")
    .or("contact_type.eq.investor,module.eq.investor")
    .not("company", "is", null)
    .order("id", { ascending: true })
    .range(from, to), { context: "runEnrichment: crm_contacts ids" });

  // Skip any contact that already has a proposal (pending/approved/rejected) — so a
  // "run all" loop makes forward progress and terminates instead of re-scanning them.
  // Chunked: .in() goes in the URL, and an uncapped id list is long enough to 414.
  const existing = new Set<string>();
  for (const part of chunk(allIds.map((r) => r.id))) {
    const { data: ex } = await db().from("investor_enrichment").select("contact_id").in("contact_id", part);
    for (const e of (ex ?? []) as { contact_id: string }[]) existing.add(e.contact_id);
  }
  const candidates = allIds.map((r) => r.id).filter((id) => !existing.has(id));

  // Now fetch the wide rows for a slice of candidates only. Over-fetch a little, because
  // some will turn out to need nothing once their profile is inspected.
  const slice = candidates.slice(0, limit * 3);
  const fetched: InvestorRow[] = [];
  for (const part of chunk(slice, 200)) {
    const { data } = await db().from("crm_contacts")
      .select("id, company, email, raw, overrides, inv_source").in("id", part);
    fetched.push(...((data ?? []) as InvestorRow[]));
  }
  const todo = fetched.filter((r) => !hasIndustry(r) || !hasType(r) || !hasStage(r)).slice(0, limit);
  // Contacts in the slice that need nothing are recorded as rejected, so the next pass
  // doesn't reconsider them and "run all" keeps making progress.
  const nothingToDo = fetched.filter((r) => hasIndustry(r) && hasType(r) && hasStage(r)).map((r) => r.id);
  if (nothingToDo.length > 0) {
    await db().from("investor_enrichment").upsert(
      nothingToDo.map((id) => ({
        contact_id: id, proposed_industries: [], proposed_type: null, proposed_stage: [],
        confidence: 0, basis: null, rationale: "Already complete — nothing missing.",
        model: CLAUDE_HAIKU, status: "rejected", updated_at: new Date().toISOString(),
      })), { onConflict: "contact_id" });
  }

  let proposed = 0, skipped = 0;
  // Set when the AI becomes unreachable: every worker stops immediately and nothing more
  // is written. Without this an outage burns through the whole candidate list marking it
  // rejected, which would be unrecoverable without manual SQL.
  let unavailable: string | null = null;
  // Process the batch with bounded concurrency so it finishes inside the serverless
  // time limit (each item is a website fetch + a Claude call).
  const CONCURRENCY = 6;
  let cursor = 0;
  async function worker() {
    while (cursor < todo.length && !unavailable) {
      const r = todo[cursor++];
      let p: (Proposal & { basis: string }) | null;
      try {
        p = await proposeFor(r);
      } catch (e) {
        if (e instanceof ClaudeUnavailableError) { unavailable = e.message; return; }
        throw e;
      }
      const hasSignal = p && (p.industries.length > 0 || p.investorType || p.stages.length > 0);
      // Record no-signal contacts as 'rejected' so they aren't retried on the next pass.
      const { error } = await db().from("investor_enrichment").upsert({
        contact_id: r.id,
        proposed_industries: hasSignal ? p!.industries : [], proposed_type: hasSignal ? p!.investorType : null,
        proposed_stage: hasSignal ? p!.stages : [],
        confidence: hasSignal ? p!.confidence : 0, basis: p?.basis ?? null,
        rationale: hasSignal ? p!.rationale : "No signal from name/domain/website.", model: CLAUDE_HAIKU,
        status: hasSignal ? "pending" : "rejected", updated_at: new Date().toISOString(),
      }, { onConflict: "contact_id" });
      if (!error && hasSignal) proposed++; else skipped++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, () => worker()));
  // remaining = candidates left after this batch (0 → run-all is done). Both the rows we
  // processed and the ones recorded as already-complete come off the list.
  const consumed = todo.length + nothingToDo.length;
  return {
    scanned: candidates.length, proposed, skipped,
    remaining: Math.max(0, candidates.length - consumed),
    unavailable,
  };
}

export type EnrichmentRow = {
  id: string; contact_id: string; company: string | null; proposed_industries: string[]; proposed_type: string | null;
  proposed_stage: string[]; confidence: number; basis: string | null; rationale: string | null; status: string;
};

export async function listProposals(status: "pending" | "approved" | "rejected" = "pending", limit = 200): Promise<EnrichmentRow[]> {
  const { data } = await db().from("investor_enrichment")
    .select("id, contact_id, proposed_industries, proposed_type, proposed_stage, confidence, basis, rationale, status, contact:crm_contacts(company)")
    .eq("status", status).order("confidence", { ascending: false }).limit(limit);
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id), contact_id: String(r.contact_id),
    company: ((r.contact as { company?: string } | null)?.company) ?? null,
    proposed_industries: (r.proposed_industries as string[]) ?? [], proposed_type: (r.proposed_type as string) ?? null,
    proposed_stage: (r.proposed_stage as string[]) ?? [],
    confidence: Number(r.confidence) || 0, basis: (r.basis as string) ?? null, rationale: (r.rationale as string) ?? null, status: String(r.status),
  }));
}

/** Approve a proposal: fill missing overrides + mark inferred (never overwriting trusted). */
export async function applyProposal(id: string, edits: { industries?: string[]; type?: string | null; stages?: string[] } | null, reviewerId?: string | null): Promise<boolean> {
  const { data: prop } = await db().from("investor_enrichment").select("contact_id, proposed_industries, proposed_type, proposed_stage").eq("id", id).maybeSingle();
  if (!prop) return false;
  const { data: c } = await db().from("crm_contacts").select("overrides, inv_source").eq("id", prop.contact_id).maybeSingle();
  const overrides = { ...((c?.overrides as Record<string, unknown> | null) ?? {}) };
  const industries = edits?.industries ?? (prop.proposed_industries as string[]) ?? [];
  const type = canonicalInvestorType(edits?.type !== undefined ? edits.type : (prop.proposed_type as string | null));
  // Edits go through the same vocabulary clamp as the model's output, so a reviewer
  // can't hand-type a stage string the matcher would never compare against.
  const stages = normalizeStages(edits?.stages ?? (prop.proposed_stage as string[]) ?? []);
  const hasInd = Array.isArray(overrides["Industries"]) && (overrides["Industries"] as unknown[]).length > 0;
  const hasTyp = Array.isArray(overrides["Investor type"]) && (overrides["Investor type"] as unknown[]).length > 0;
  // Don't overwrite a stage the contact already has under EITHER label.
  const hasStg = OP_STAGE_LABELS.some((l) => Array.isArray(overrides[l]) && (overrides[l] as unknown[]).length > 0);
  if (industries.length && !hasInd) overrides["Industries"] = canonicalizeIndustries(industries);
  if (type && !hasTyp) overrides["Investor type"] = [type];
  if (stages.length && !hasStg) overrides[OP_STAGE_LABEL] = stages;
  // Only mark inferred when the contact isn't already verified/self_reported.
  const trusted = c?.inv_source === "verified" || c?.inv_source === "self_reported";
  const now = new Date().toISOString();
  // NOTE: crm_contacts has no updated_at column (it has synced_at, set by the connector,
  // and a generated created_on). Writing updated_at failed the whole update, which is why
  // approvals appeared to succeed while nothing landed.
  let error = null;
  if (!trusted) {
    ({ error } = await db().from("crm_contacts").update({ overrides, inv_source: "inferred" }).eq("id", prop.contact_id));
  }
  // Fall back to overrides-only if inv_source rejects the value (constrained column).
  if (trusted || error) {
    ({ error } = await db().from("crm_contacts").update({ overrides }).eq("id", prop.contact_id));
  }
  if (error) return false;
  await db().from("investor_enrichment").update({ status: "approved", reviewed_by: reviewerId ?? null, reviewed_at: now }).eq("id", id);
  // Push the approved values into the match index now. An in-app edit doesn't move
  // synced_at, so the scheduled incremental rebuild would not notice it and the approval
  // would have no effect on /fit until a manual full rebuild. Best-effort.
  await reindexContacts([prop.contact_id as string]).catch(() => 0);
  return true;
}

export async function rejectProposal(id: string, reviewerId?: string | null): Promise<boolean> {
  const { error } = await db().from("investor_enrichment").update({ status: "rejected", reviewed_by: reviewerId ?? null, reviewed_at: new Date().toISOString() }).eq("id", id);
  return !error;
}

/** Approve every pending proposal at or above a confidence floor. */
export async function approveHighConfidence(minConfidence: number, reviewerId?: string | null): Promise<number> {
  const { data } = await db().from("investor_enrichment").select("id").eq("status", "pending").gte("confidence", minConfidence);
  let n = 0;
  for (const r of (data ?? []) as { id: string }[]) if (await applyProposal(r.id, null, reviewerId)) n++;
  return n;
}
