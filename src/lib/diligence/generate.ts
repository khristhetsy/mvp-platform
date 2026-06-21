// AI draft generation (§12). Reads a company business summary and drafts
// domains + findings + claims for ADMIN EDIT — never auto-published. Uses the
// repo's claudeComplete() helper (native fetch, no SDK).

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "@/lib/claude";
import { nextFindingCode } from "./codes";
import { ddAudit } from "./audit";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

const SYSTEM = `You are a venture diligence analyst. Read the company business summary and output ONLY JSON:
{ "domains":[{"code","name","overview","strengths":[],"mitigation":[],"conclusion","risk_rating":"high|medium|low"}],
  "findings":[{"domain_code","title","detail","severity":"high|medium|low","source","suggested_verification":"unverified|requested"}],
  "claims":[{"claim","claimed_value","source_asserted","linked_finding_title"}] }
Use domain codes D-01 Structure, D-02 Market, D-03 Competitive, D-04 Sales, D-05 Financial.
No prose, no markdown fences. Paraphrase; never copy source text verbatim.`;

const DraftSchema = z.object({
  domains: z.array(z.object({
    code: z.string(),
    name: z.string(),
    overview: z.string().nullish(),
    strengths: z.array(z.string()).default([]),
    mitigation: z.array(z.string()).default([]),
    conclusion: z.string().nullish(),
    risk_rating: z.enum(["high", "medium", "low"]).nullish(),
  })).default([]),
  findings: z.array(z.object({
    domain_code: z.string().nullish(),
    title: z.string(),
    detail: z.string().nullish(),
    severity: z.enum(["high", "medium", "low"]),
    source: z.string().nullish(),
    suggested_verification: z.enum(["unverified", "requested"]).default("unverified"),
  })).default([]),
  claims: z.array(z.object({
    claim: z.string(),
    claimed_value: z.string().nullish(),
    source_asserted: z.string().nullish(),
    linked_finding_title: z.string().nullish(),
  })).default([]),
});

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI drafting isn't configured. Add ANTHROPIC_API_KEY, or build the register manually.");
    this.name = "AiNotConfiguredError";
  }
}

export async function generateFindingsFromText(
  supabase: SupabaseClient<Database>,
  engagementId: string,
  actorId: string,
  sourceText: string,
): Promise<{ count: number }> {
  if (!isClaudeConfigured()) throw new AiNotConfiguredError();

  const reply = await claudeComplete(
    [{ role: "user", content: sourceText.slice(0, 60000) }],
    { model: CLAUDE_SONNET, maxTokens: 4000, system: SYSTEM, temperature: 0.2 },
  );

  let parsed: z.infer<typeof DraftSchema>;
  try {
    const cleaned = reply.replace(/```json|```/g, "").trim();
    parsed = DraftSchema.parse(JSON.parse(cleaned));
  } catch {
    throw new Error("The AI response could not be parsed. Try again or shorten the summary.");
  }

  // 1. Upsert domains by code (seeded D-01..D-05 already exist).
  if (parsed.domains.length) {
    await raw(supabase).from("dd_domains").upsert(
      parsed.domains.map((d) => ({
        engagement_id: engagementId,
        code: d.code,
        name: d.name,
        overview: d.overview ?? null,
        strengths: d.strengths,
        mitigation: d.mitigation,
        conclusion: d.conclusion ?? null,
        risk_rating: d.risk_rating ?? null,
      })),
      { onConflict: "engagement_id,code" },
    );
  }

  // Map domain code → id for finding linkage.
  const { data: domainRows } = await raw(supabase).from("dd_domains").select("id, code").eq("engagement_id", engagementId);
  const domainIdByCode = new Map<string, string>();
  for (const r of (domainRows ?? []) as Array<{ id: string; code: string }>) domainIdByCode.set(r.code, r.id);

  // 2. Insert findings with sequential codes.
  const { data: existingFindings } = await raw(supabase).from("dd_findings").select("finding_code").eq("engagement_id", engagementId);
  const used = ((existingFindings ?? []) as Array<{ finding_code: string }>).map((r) => r.finding_code);

  const titleToFindingId = new Map<string, string>();
  for (const f of parsed.findings) {
    const code = nextFindingCode(used);
    used.push(code);
    const { data: inserted } = await raw(supabase)
      .from("dd_findings")
      .insert({
        engagement_id: engagementId,
        finding_code: code,
        domain_id: f.domain_code ? domainIdByCode.get(f.domain_code) ?? null : null,
        title: f.title,
        detail: f.detail ?? null,
        severity: f.severity,
        status: "open",
        verification: f.suggested_verification,
        source: f.source ?? null,
      })
      .select("id, title")
      .single();
    if (inserted) titleToFindingId.set((inserted as { title: string }).title, (inserted as { id: string }).id);
  }

  // 3. Insert claims, linked to findings by title where possible.
  if (parsed.claims.length) {
    await raw(supabase).from("dd_claims").insert(
      parsed.claims.map((c) => ({
        engagement_id: engagementId,
        claim: c.claim,
        claimed_value: c.claimed_value ?? null,
        source_asserted: c.source_asserted ?? null,
        verification: "unverified",
        finding_id: c.linked_finding_title ? titleToFindingId.get(c.linked_finding_title) ?? null : null,
        weight: 1,
      })),
    );
  }

  await ddAudit(supabase, {
    engagementId,
    actorId,
    action: "ai.generate",
    target: engagementId,
    after: { findings: parsed.findings.length, claims: parsed.claims.length, domains: parsed.domains.length },
  });

  return { count: parsed.findings.length };
}
