/**
 * Investable Readiness Scoring — OpenAI engine
 *
 * Scores a company across 8 investor-facing factors (100 pts total)
 * using document AI summaries as inputs.
 * Uses the existing OpenAI client (gpt-4.1-mini) — no new API key needed.
 *
 * IMPORTANT: Score is investor/admin-only — never surfaced to founders.
 */

// Uses Anthropic Messages API via fetch — no SDK required

// ─── Factor definitions ──────────────────────────────────────────────────────

export const READINESS_FACTORS = [
  { key: "revenue_cashflow",      label: "Revenue & Cash Flow Trajectory",  max: 20, tag: "Financial"   },
  { key: "founder_integrity",     label: "Founder Integrity & Track Record", max: 18, tag: "Team"        },
  { key: "governance_legal",      label: "Governance & Legal Cleanliness",   max: 15, tag: "Legal"       },
  { key: "market_evidence",       label: "Market Realism & Customer Evidence",max: 15, tag: "Market"     },
  { key: "pitch_quality",         label: "Pitch Deck & Business Plan Quality",max: 12, tag: "Documents"  },
  { key: "deal_structure",        label: "Deal Structure Flexibility",        max: 10, tag: "Deal Terms" },
  { key: "industry_alignment",    label: "Industry & Stage Alignment",        max: 5,  tag: "Fit"        },
  { key: "impact_esg",            label: "Impact / ESG Alignment",            max: 5,  tag: "ESG"        },
] as const;

export type FactorKey = (typeof READINESS_FACTORS)[number]["key"];

export type FactorSubScore = {
  label: string;
  pts: number;
  max: number;
};

export type FactorEvidence = {
  icon: "✅" | "⚠️" | "❌";
  text: string;
  src: string;
};

export type FactorFlag = {
  severity: "red" | "amber" | "green";
  label: string;
  detail: string;
};

export type FactorScore = {
  pts: number;
  max: number;
  rating: "Strong" | "Developing" | "Needs Work";
  aiSummary: string;
  subScores: FactorSubScore[];
  evidence: FactorEvidence[];
  flags: FactorFlag[];
};

export type ReadinessScoreResult = {
  totalScore: number;
  factorScores: Record<FactorKey, FactorScore>;
  generatedBy: "claude" | "unconfigured";
  isDemo: boolean;
};

// ─── Rating helper ────────────────────────────────────────────────────────────

function ratingFromPct(pct: number): FactorScore["rating"] {
  if (pct >= 0.75) return "Strong";
  if (pct >= 0.45) return "Developing";
  return "Needs Work";
}

// ─── Demo fallback (no API key) ───────────────────────────────────────────────

function buildDemoScore(): ReadinessScoreResult {
  const factorScores = {} as Record<FactorKey, FactorScore>;
  let total = 0;

  for (const f of READINESS_FACTORS) {
    const pts = Math.round(f.max * 0.6);
    total += pts;
    factorScores[f.key as FactorKey] = {
      pts,
      max: f.max,
      rating: ratingFromPct(0.6),
      aiSummary:
        "AI scoring is not configured in this environment. This is a placeholder score for demonstration purposes.",
      subScores: [],
      evidence: [
        {
          icon: "⚠️",
          text: "AI scoring requires OPENAI_API_KEY to be configured.",
          src: "System",
        },
      ],
      flags: [],
    };
  }

  return {
    totalScore: Math.min(100, total),
    factorScores,
    generatedBy: "unconfigured",
    isDemo: true,
  };
}

// ─── Main scoring function ────────────────────────────────────────────────────

export async function scoreCompanyReadiness(input: {
  companyName: string;
  industry: string | null;
  revenueStage: string | null;
  fundingAmount: number | null;
  documentSummaries: Array<{ type: string; summary: string }>;
  uploadedDocumentTypes: string[];
}): Promise<ReadinessScoreResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return buildDemoScore();
  }

  const systemPrompt = `You are an institutional-grade investment analyst producing structured readiness scores for investor due diligence.

You will receive company information and document summaries, then score the company across 8 factors.

RULES:
- Be conservative and evidence-based. Only score what you can see in the documents.
- Never invent evidence or fabricate document contents.
- If a document is missing, reflect that as lower scores and flags.
- Scores must sum to the per-factor maximum shown.
- Return ONLY valid JSON matching the schema below — no prose, no markdown, no code fences.

OUTPUT SCHEMA (return as raw JSON only):
{
  "factors": {
    "revenue_cashflow":    { "pts": <0-20>, "aiSummary": "...", "subScores": [{"label":"...","pts":N,"max":N},...], "evidence": [{"icon":"✅|⚠️|❌","text":"...","src":"..."},...], "flags": [{"severity":"red|amber|green","label":"...","detail":"..."},...] },
    "founder_integrity":   { "pts": <0-18>, "aiSummary": "...", "subScores": [...], "evidence": [...], "flags": [...] },
    "governance_legal":    { "pts": <0-15>, "aiSummary": "...", "subScores": [...], "evidence": [...], "flags": [...] },
    "market_evidence":     { "pts": <0-15>, "aiSummary": "...", "subScores": [...], "evidence": [...], "flags": [...] },
    "pitch_quality":       { "pts": <0-12>, "aiSummary": "...", "subScores": [...], "evidence": [...], "flags": [...] },
    "deal_structure":      { "pts": <0-10>, "aiSummary": "...", "subScores": [...], "evidence": [...], "flags": [...] },
    "industry_alignment":  { "pts": <0-5>,  "aiSummary": "...", "subScores": [...], "evidence": [...], "flags": [...] },
    "impact_esg":          { "pts": <0-5>,  "aiSummary": "...", "subScores": [...], "evidence": [...], "flags": [...] }
  }
}`;

  const userContent = JSON.stringify({
    company: {
      name: input.companyName,
      industry: input.industry,
      revenueStage: input.revenueStage,
      fundingAmountUSD: input.fundingAmount,
    },
    uploadedDocumentTypes: input.uploadedDocumentTypes,
    documentSummaries: input.documentSummaries,
    missingDocuments: [
      "PITCH_DECK",
      "BUSINESS_PLAN",
      "FINANCIAL_STATEMENTS",
      "CAP_TABLE",
      "INCORPORATION_DOCS",
    ].filter((t) => !input.uploadedDocumentTypes.includes(t)),
  });

  let rawText = "";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[readiness-scoring] Anthropic API error", res.status, errBody);
      return buildDemoScore();
    }

    const json = await res.json() as { content: Array<{ type: string; text: string }> };
    rawText = json.content?.[0]?.text ?? "";
  } catch (err) {
    console.error("[readiness-scoring] Anthropic fetch error", err);
    return buildDemoScore();
  }

  // Strip any markdown code fences
  const jsonText = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: { factors: Record<string, Omit<FactorScore, "rating" | "max">> };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    console.error("[readiness-scoring] Failed to parse Claude response", rawText.slice(0, 200));
    return buildDemoScore();
  }

  const factorScores = {} as Record<FactorKey, FactorScore>;
  let total = 0;

  for (const f of READINESS_FACTORS) {
    const raw = parsed.factors?.[f.key as string];
    const pts = Math.min(f.max, Math.max(0, Number(raw?.pts ?? 0)));
    total += pts;
    factorScores[f.key as FactorKey] = {
      pts,
      max: f.max,
      rating: ratingFromPct(pts / f.max),
      aiSummary: String(raw?.aiSummary ?? ""),
      subScores: Array.isArray(raw?.subScores) ? (raw.subScores as FactorSubScore[]) : [],
      evidence: Array.isArray(raw?.evidence) ? (raw.evidence as FactorEvidence[]) : [],
      flags: Array.isArray(raw?.flags) ? (raw.flags as FactorFlag[]) : [],
    };
  }

  return {
    totalScore: Math.min(100, total),
    factorScores,
    generatedBy: "claude",
    isDemo: false,
  };
}
