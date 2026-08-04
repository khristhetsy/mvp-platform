// Structured data for the business-plan AI charts + AI extraction from section text.
import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "@/lib/claude";
import type { BusinessPlan } from "./types";

export interface AllocationSlice { label: string; pct: number }
export interface MarketSize { tam: number | null; sam: number | null; som: number | null }

// Problem — how much pain the status quo causes (same unit across bars).
export interface PainBar { label: string; value: number; unit: string }
// Solution — the same workflows before vs after the product.
export interface BeforeAfter { label: string; before: number; after: number }
// Competitive landscape — a 0–10 positioning matrix; one point is "you".
export interface MatrixPoint { label: string; x: number; y: number; you: boolean }
// Traction — a value series over periods, with milestone markers.
export interface TractionPoint { period: string; value: number }
export interface Milestone { period: string; label: string }
export interface TractionChart { series: TractionPoint[]; milestones: Milestone[]; unit: string }

export interface PlanCharts {
  allocation: AllocationSlice[];
  market: MarketSize;
  problem: PainBar[];
  solution: BeforeAfter[];
  competition: MatrixPoint[];
  traction: TractionChart;
}

export const DEFAULT_CHARTS: PlanCharts = {
  allocation: [
    { label: "Engineering", pct: 45 },
    { label: "Go-to-market", pct: 30 },
    { label: "Operations", pct: 15 },
    { label: "Reserve", pct: 10 },
  ],
  market: { tam: null, sam: null, som: null },
  problem: [
    { label: "Manual data entry", value: 9, unit: "h/wk" },
    { label: "Chasing approvals", value: 6, unit: "h/wk" },
    { label: "Reworking errors", value: 5, unit: "h/wk" },
  ],
  solution: [
    { label: "Onboarding", before: 8, after: 2 },
    { label: "Reporting", before: 6, after: 1 },
    { label: "Reconciliation", before: 9, after: 2 },
  ],
  competition: [
    { label: "You", x: 8, y: 8, you: true },
    { label: "Legacy A", x: 7, y: 3, you: false },
    { label: "Legacy B", x: 4, y: 5, you: false },
    { label: "Spreadsheets", x: 1.5, y: 7, you: false },
  ],
  traction: {
    series: [
      { period: "Q1", value: 5 },
      { period: "Q2", value: 9 },
      { period: "Q3", value: 14 },
      { period: "Q4", value: 22 },
    ],
    milestones: [{ period: "Q2", label: "First paying customer" }],
    unit: "k MRR",
  },
};

function numOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function clampNum(v: unknown, min: number, max: number, dflt: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : dflt;
}
function str(v: unknown, max = 40): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

export function normalizeCharts(raw: unknown): PlanCharts {
  const c = (raw ?? {}) as Partial<PlanCharts>;

  const allocation = Array.isArray(c.allocation) && c.allocation.length
    ? c.allocation.filter((a) => a && typeof a.label === "string").map((a) => ({ label: str(a.label), pct: clampNum(a.pct, 0, 100, 0) })).slice(0, 8)
    : DEFAULT_CHARTS.allocation;

  const m = (c.market ?? {}) as Partial<MarketSize>;
  const market = { tam: numOrNull(m.tam), sam: numOrNull(m.sam), som: numOrNull(m.som) };

  const problem = Array.isArray(c.problem) && c.problem.length
    ? c.problem.filter((p) => p && typeof p.label === "string").slice(0, 6).map((p) => ({ label: str(p.label), value: clampNum(p.value, 0, 1e9, 0), unit: str(p.unit, 10) || "h/wk" }))
    : DEFAULT_CHARTS.problem;

  const solution = Array.isArray(c.solution) && c.solution.length
    ? c.solution.filter((s) => s && typeof s.label === "string").slice(0, 6).map((s) => ({ label: str(s.label), before: clampNum(s.before, 0, 1e9, 0), after: clampNum(s.after, 0, 1e9, 0) }))
    : DEFAULT_CHARTS.solution;

  const competition = Array.isArray(c.competition) && c.competition.length
    ? c.competition.filter((p) => p && typeof p.label === "string").slice(0, 6).map((p) => ({ label: str(p.label), x: clampNum(p.x, 0, 10, 5), y: clampNum(p.y, 0, 10, 5), you: Boolean(p.you) }))
    : DEFAULT_CHARTS.competition;

  const tRaw = (c.traction ?? {}) as Partial<TractionChart>;
  const series = Array.isArray(tRaw.series) && tRaw.series.length
    ? tRaw.series.filter((p) => p && typeof p.period === "string").slice(0, 8).map((p) => ({ period: str(p.period, 8), value: clampNum(p.value, 0, 1e12, 0) }))
    : DEFAULT_CHARTS.traction.series;
  const milestones = Array.isArray(tRaw.milestones)
    ? tRaw.milestones.filter((mi) => mi && typeof mi.period === "string" && typeof mi.label === "string").slice(0, 4).map((mi) => ({ period: str(mi.period, 8), label: str(mi.label, 40) }))
    : DEFAULT_CHARTS.traction.milestones;
  const traction: TractionChart = { series, milestones, unit: str(tRaw.unit, 12) || DEFAULT_CHARTS.traction.unit };

  return { allocation, market, problem, solution, competition, traction };
}

// Pull a $ figure like "$4B", "4 billion", "800M" → number.
function parseMoney(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/[, ]/g, "").match(/\$?([\d.]+)\s*(b|bn|billion|m|mm|million|k|thousand)?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] || "").toLowerCase();
  if (unit.startsWith("b")) return n * 1e9;
  if (unit.startsWith("m")) return n * 1e6;
  if (unit.startsWith("k") || unit.startsWith("t")) return n * 1e3;
  return n;
}

// AI-extract chart figures from the plan's own text. Grounded; falls back to defaults.
export async function extractCharts(plan: BusinessPlan): Promise<PlanCharts> {
  const s = plan.sections ?? {};
  const useOfFunds = s.use_of_funds?.content ?? "";
  const market = s.market?.content ?? "";
  const problemText = s.problem?.content ?? "";
  const solutionText = s.solution?.content ?? "";
  const competitionText = s.competition?.content ?? "";
  const tractionText = s.traction?.content ?? "";

  const fallbackMarket: MarketSize = {
    tam: parseMoney(market.match(/tam[^$0-9]*([$\d.,]+\s*(?:b|bn|billion|m|mm|million|k)?)/i)?.[1]),
    sam: parseMoney(market.match(/sam[^$0-9]*([$\d.,]+\s*(?:b|bn|billion|m|mm|million|k)?)/i)?.[1]),
    som: parseMoney(market.match(/som[^$0-9]*([$\d.,]+\s*(?:b|bn|billion|m|mm|million|k)?)/i)?.[1]),
  };

  const anyText = [useOfFunds, market, problemText, solutionText, competitionText, tractionText].some((t) => t.trim());
  if (!isClaudeConfigured() || !anyText) {
    return normalizeCharts({ allocation: DEFAULT_CHARTS.allocation, market: fallbackMarket });
  }

  const prompt = `From the founder's business-plan text below, produce strict JSON and nothing else. These become editable starter charts — propose reasonable, plausible values the founder will refine. Never fabricate specific dollar market sizes (use null when not stated); for the other charts, plausible estimates are fine.

Return this exact shape:
{
  "allocation": [{"label": "", "pct": 0}],
  "market": {"tam": null, "sam": null, "som": null},
  "problem": [{"label": "", "value": 0, "unit": "h/wk"}],
  "solution": [{"label": "", "before": 0, "after": 0}],
  "competition": [{"label": "You", "x": 0, "y": 0, "you": true}, {"label": "", "x": 0, "y": 0, "you": false}],
  "traction": {"series": [{"period": "Q1", "value": 0}], "milestones": [{"period": "Q2", "label": ""}], "unit": "k MRR"}
}

Rules:
- allocation: how the raise is used, pct integers summing to ~100.
- market: TAM/SAM/SOM in plain dollars (e.g. 4000000000) or null.
- problem: 2–4 quantified pain points, all in ONE shared unit (e.g. hours per week).
- solution: 2–4 workflows with a "before" and lower "after" in the same unit.
- competition: 3–5 points on a 0–10 grid where x = automation depth, y = ease of adoption. Exactly one has "you": true.
- traction: a rising value series over periods with 1–2 milestone markers; unit like "k MRR" or "users".

USE OF FUNDS:
${useOfFunds || "[none]"}

MARKET:
${market || "[none]"}

PROBLEM:
${problemText || "[none]"}

SOLUTION:
${solutionText || "[none]"}

COMPETITION:
${competitionText || "[none]"}

TRACTION:
${tractionText || "[none]"}`;

  try {
    const out = await claudeComplete([{ role: "user", content: prompt }], {
      model: CLAUDE_SONNET,
      maxTokens: 900,
      temperature: 0.2,
      system: "You extract structured JSON from text. Output only valid JSON. Never fabricate specific dollar market-size figures — use null when not stated.",
    });
    const json = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
    const parsed = normalizeCharts(json);
    parsed.market = {
      tam: parsed.market.tam ?? fallbackMarket.tam,
      sam: parsed.market.sam ?? fallbackMarket.sam,
      som: parsed.market.som ?? fallbackMarket.som,
    };
    return parsed;
  } catch {
    return normalizeCharts({ allocation: DEFAULT_CHARTS.allocation, market: fallbackMarket });
  }
}
