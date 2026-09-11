/**
 * AI enrichment for investor contacts missing matching data (industry / type).
 * Proposals are stored in investor_enrichment for review; on approval they're written
 * to crm_contacts.overrides with inv_source='inferred' — never overwriting verified or
 * self_reported data. Stage / check size / revenue are intentionally NOT guessed.
 * Server-only, except the pure parseProposal (unit-tested).
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { claudeComplete, isClaudeConfigured, CLAUDE_HAIKU } from "@/lib/claude";
import { canonicalizeIndustries } from "@/lib/industries/canonical";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type Proposal = { industries: string[]; investorType: string | null; confidence: number; rationale: string };

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
  const investorType = typeof t === "string" && t.trim() && !/^(unknown|n\/a|none)$/i.test(t.trim()) ? t.trim() : null;
  let confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.max(0, Math.min(100, Math.round(confidence)));
  const rationale = typeof raw.rationale === "string" ? raw.rationale.slice(0, 300) : "";
  return { industries, investorType, confidence, rationale };
}

const SYSTEM = [
  "You classify an investment firm from limited signals (company name and email domain).",
  "Return STRICT JSON only, no prose: {\"industries\": string[], \"investorType\": string|null, \"confidence\": 0-100, \"rationale\": string}.",
  "industries = the sectors this investor most likely funds (e.g. 'Fintech','SaaS','Healthcare','Real Estate','Deep Tech'); [] if you truly cannot tell.",
  "investorType = one of: 'VC','Angel','Family Office','Private Equity','Corporate VC','Accelerator', or null if unclear.",
  "confidence reflects how sure you are from the name/domain alone. Be conservative: a generic holding-company name is low confidence. Never invent a sector to be helpful.",
].join(" ");

type InvestorRow = { id: string; company: string | null; email: string | null; raw: Record<string, unknown> | null; overrides: Record<string, unknown> | null; inv_source: string | null };

function domainOf(email: string | null): string | null {
  if (!email || !email.includes("@")) return null;
  return email.split("@")[1].trim().toLowerCase() || null;
}
// Generic mailbox domains carry no company signal — don't fetch a "website" for them.
const GENERIC_DOMAINS = new Set(["gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com", "proton.me", "protonmail.com"]);

/** Best-effort homepage text for a domain (timeout + size capped). Null on any failure. */
async function fetchSiteText(domain: string | null): Promise<string | null> {
  if (!domain || GENERIC_DOMAINS.has(domain)) return null;
  try {
    const res = await fetch(`https://${domain}`, { redirect: "follow", signal: AbortSignal.timeout(4000), headers: { "user-agent": "iCapOS-enrichment/1.0" } });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 40000);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500);
    return text || null;
  } catch { return null; }
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

/** Propose enrichment for one investor via Claude. Returns null if not configured/failed. */
export async function proposeFor(row: InvestorRow): Promise<(Proposal & { basis: string }) | null> {
  if (!isClaudeConfigured()) return null;
  const domain = domainOf(row.email);
  const site = await fetchSiteText(domain);
  const basis = site ? "website" : domain ? "domain" : "name";
  const user = [
    `Company: ${row.company ?? "(unknown)"}`,
    `Email domain: ${domain ?? "(none)"}`,
    site ? `Website text (excerpt): ${site}` : null,
  ].filter(Boolean).join("\n");
  try {
    const reply = await claudeComplete([{ role: "user", content: user }], { model: CLAUDE_HAIKU, system: SYSTEM, maxTokens: 300, temperature: 0 });
    const p = parseProposal(reply);
    if (!p) return null;
    return { ...p, industries: canonicalizeIndustries(p.industries), basis };
  } catch { return null; }
}

/** Run a capped batch: propose for investors missing industry or type, store as pending. */
export async function runEnrichment(limit = 40): Promise<{ scanned: number; proposed: number; skipped: number; remaining: number }> {
  const { data } = await db().from("crm_contacts")
    .select("id, company, email, raw, overrides, inv_source")
    .or("contact_type.eq.investor,module.eq.investor").not("company", "is", null).limit(20000);
  const rows = (data ?? []) as InvestorRow[];
  const missing = rows.filter((r) => !hasIndustry(r) || !hasType(r));

  // Skip any contact that already has a proposal (pending/approved/rejected) — so a
  // "run all" loop makes forward progress and terminates instead of re-scanning them.
  const ids = missing.map((r) => r.id);
  const existing = new Set<string>();
  if (ids.length) {
    const { data: ex } = await db().from("investor_enrichment").select("contact_id").in("contact_id", ids);
    for (const e of (ex ?? []) as { contact_id: string }[]) existing.add(e.contact_id);
  }
  const pending = missing.filter((r) => !existing.has(r.id));
  const todo = pending.slice(0, limit);

  let proposed = 0, skipped = 0;
  // Process the batch with bounded concurrency so it finishes inside the serverless
  // time limit (each item is a website fetch + a Claude call).
  const CONCURRENCY = 6;
  let cursor = 0;
  async function worker() {
    while (cursor < todo.length) {
      const r = todo[cursor++];
      const p = await proposeFor(r);
      const hasSignal = p && (p.industries.length > 0 || p.investorType);
      // Record no-signal contacts as 'rejected' so they aren't retried on the next pass.
      const { error } = await db().from("investor_enrichment").upsert({
        contact_id: r.id,
        proposed_industries: hasSignal ? p!.industries : [], proposed_type: hasSignal ? p!.investorType : null,
        confidence: hasSignal ? p!.confidence : 0, basis: p?.basis ?? null,
        rationale: hasSignal ? p!.rationale : "No signal from name/domain/website.", model: CLAUDE_HAIKU,
        status: hasSignal ? "pending" : "rejected", updated_at: new Date().toISOString(),
      }, { onConflict: "contact_id" });
      if (!error && hasSignal) proposed++; else skipped++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, () => worker()));
  // remaining = un-proposed candidates left after this batch (0 → run-all is done).
  return { scanned: missing.length, proposed, skipped, remaining: Math.max(0, pending.length - todo.length) };
}

export type EnrichmentRow = {
  id: string; contact_id: string; company: string | null; proposed_industries: string[]; proposed_type: string | null;
  confidence: number; basis: string | null; rationale: string | null; status: string;
};

export async function listProposals(status: "pending" | "approved" | "rejected" = "pending", limit = 200): Promise<EnrichmentRow[]> {
  const { data } = await db().from("investor_enrichment")
    .select("id, contact_id, proposed_industries, proposed_type, confidence, basis, rationale, status, contact:crm_contacts(company)")
    .eq("status", status).order("confidence", { ascending: false }).limit(limit);
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id), contact_id: String(r.contact_id),
    company: ((r.contact as { company?: string } | null)?.company) ?? null,
    proposed_industries: (r.proposed_industries as string[]) ?? [], proposed_type: (r.proposed_type as string) ?? null,
    confidence: Number(r.confidence) || 0, basis: (r.basis as string) ?? null, rationale: (r.rationale as string) ?? null, status: String(r.status),
  }));
}

/** Approve a proposal: fill missing overrides + mark inferred (never overwriting trusted). */
export async function applyProposal(id: string, edits: { industries?: string[]; type?: string | null } | null, reviewerId?: string | null): Promise<boolean> {
  const { data: prop } = await db().from("investor_enrichment").select("contact_id, proposed_industries, proposed_type").eq("id", id).maybeSingle();
  if (!prop) return false;
  const { data: c } = await db().from("crm_contacts").select("overrides, inv_source").eq("id", prop.contact_id).maybeSingle();
  const overrides = { ...((c?.overrides as Record<string, unknown> | null) ?? {}) };
  const industries = edits?.industries ?? (prop.proposed_industries as string[]) ?? [];
  const type = edits?.type !== undefined ? edits.type : (prop.proposed_type as string | null);
  const hasInd = Array.isArray(overrides["Industries"]) && (overrides["Industries"] as unknown[]).length > 0;
  const hasTyp = Array.isArray(overrides["Investor type"]) && (overrides["Investor type"] as unknown[]).length > 0;
  if (industries.length && !hasInd) overrides["Industries"] = canonicalizeIndustries(industries);
  if (type && !hasTyp) overrides["Investor type"] = [type];
  // Only mark inferred when the contact isn't already verified/self_reported.
  const trusted = c?.inv_source === "verified" || c?.inv_source === "self_reported";
  const patch: Record<string, unknown> = { overrides, updated_at: new Date().toISOString() };
  if (!trusted) patch.inv_source = "inferred";
  const { error } = await db().from("crm_contacts").update(patch).eq("id", prop.contact_id);
  if (error) return false;
  await db().from("investor_enrichment").update({ status: "approved", reviewed_by: reviewerId ?? null, reviewed_at: new Date().toISOString() }).eq("id", id);
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
