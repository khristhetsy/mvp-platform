// Structured data for the business-plan AI charts + AI extraction from section text.
import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "@/lib/claude";
import type { BusinessPlan } from "./types";

export interface AllocationSlice { label: string; pct: number }
export interface MarketSize { tam: number | null; sam: number | null; som: number | null }
export interface PlanCharts {
  allocation: AllocationSlice[];
  market: MarketSize;
}

export const DEFAULT_CHARTS: PlanCharts = {
  allocation: [
    { label: "Engineering", pct: 45 },
    { label: "Go-to-market", pct: 30 },
    { label: "Operations", pct: 15 },
    { label: "Reserve", pct: 10 },
  ],
  market: { tam: null, sam: null, som: null },
};

export function normalizeCharts(raw: unknown): PlanCharts {
  const c = (raw ?? {}) as Partial<PlanCharts>;
  const allocation = Array.isArray(c.allocation) && c.allocation.length
    ? c.allocation.filter((a) => a && typeof a.label === "string").map((a) => ({ label: String(a.label).slice(0, 40), pct: Math.max(0, Math.min(100, Number(a.pct) || 0)) })).slice(0, 8)
    : DEFAULT_CHARTS.allocation;
  const m = (c.market ?? {}) as Partial<MarketSize>;
  return { allocation, market: { tam: numOrNull(m.tam), sam: numOrNull(m.sam), som: numOrNull(m.som) } };
}
function numOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
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

// AI-extract allocation + market figures from the plan's own text. Grounded; falls back to regex.
export async function extractCharts(plan: BusinessPlan): Promise<PlanCharts> {
  const useOfFunds = plan.sections?.use_of_funds?.content ?? "";
  const market = plan.sections?.market?.content ?? "";

  // Regex fallback for TAM/SAM/SOM.
  const fallbackMarket: MarketSize = {
    tam: parseMoney(market.match(/tam[^$0-9]*([$\d.,]+\s*(?:b|bn|billion|m|mm|million|k)?)/i)?.[1]),
    sam: parseMoney(market.match(/sam[^$0-9]*([$\d.,]+\s*(?:b|bn|billion|m|mm|million|k)?)/i)?.[1]),
    som: parseMoney(market.match(/som[^$0-9]*([$\d.,]+\s*(?:b|bn|billion|m|mm|million|k)?)/i)?.[1]),
  };

  if (!isClaudeConfigured() || (!useOfFunds && !market)) {
    return normalizeCharts({ allocation: DEFAULT_CHARTS.allocation, market: fallbackMarket });
  }

  const prompt = `From the founder's text below, extract two things as strict JSON and nothing else:
1) "allocation": an array of {label, pct} for how the raise is used (pct are integers that sum to ~100). If not stated, return a reasonable default for an early-stage startup.
2) "market": {tam, sam, som} as plain numbers in dollars (e.g. 4000000000). Use null if a figure isn't stated. Never invent figures — null is correct when unknown.

USE OF FUNDS:
${useOfFunds || "[none]"}

MARKET:
${market || "[none]"}

Return only JSON: {"allocation":[{"label":"","pct":0}],"market":{"tam":null,"sam":null,"som":null}}`;

  try {
    const out = await claudeComplete([{ role: "user", content: prompt }], { model: CLAUDE_SONNET, maxTokens: 500, temperature: 0.2, system: "You extract structured JSON from text. Output only valid JSON. Never fabricate financial figures — use null when a number is not stated." });
    const json = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
    const parsed = normalizeCharts(json);
    // Prefer AI market, fall back to regex per-field.
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
