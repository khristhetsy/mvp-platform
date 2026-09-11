/** Client-safe mirror of the funnel types (no server imports). */
export type Grain = "week" | "month" | "quarter" | "year";
export type StageKey = "outreach" | "impressions" | "clicks" | "meetings" | "conversions";

export const STAGES: StageKey[] = ["outreach", "impressions", "clicks", "meetings", "conversions"];
export const STAGE_LABELS: Record<StageKey, string> = {
  outreach: "Outreach", impressions: "Impressions", clicks: "Clicks", meetings: "Meetings", conversions: "Conversions",
};
export const STAGE_COLORS: Record<StageKey, string> = {
  outreach: "#534AB7", impressions: "#2A4B86", clicks: "#185FA5", meetings: "#0F6E56", conversions: "#3B6D11",
};
export const GRAINS: Grain[] = ["week", "month", "quarter", "year"];
export const GRAIN_LABELS: Record<Grain, string> = { week: "Week", month: "Month", quarter: "Quarter", year: "Year" };

export type StageResult = {
  stage: StageKey;
  actual: number;
  target: number | null;
  pctOfGoal: number | null;
  prevActual: number;
  deltaPct: number | null;
  stepFromPrevRatio: number | null;
  estimated: boolean;
};

export type CampaignFunnel = {
  campaignId: string;
  name: string;
  sourceTag: string;
  grain: Grain;
  periodStart: string;
  stages: StageResult[];
  members: number;
  revenueCents: number;
};

/** Compact number for display (1.2k, 37.2k). */
export function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 1 : 1)}k`.replace(".0k", "k");
  return String(Math.round(n));
}

export function stage(f: CampaignFunnel | { stages: StageResult[] }, k: StageKey): StageResult | undefined {
  return f.stages.find((s) => s.stage === k);
}
