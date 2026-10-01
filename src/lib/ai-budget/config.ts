// Pure config for the AI budget. Safe to import from client components.
// Enforcement and logging live in ./service (server only).

export const AI_BUDGET_CATEGORIES = [
  "founder",
  "investor",
  "public",
  "internal",
  "scheduled",
  "enrichment",
  "voice",
] as const;
export type AiBudgetCategory = (typeof AI_BUDGET_CATEGORIES)[number];

export function isCategory(v: unknown): v is AiBudgetCategory {
  return typeof v === "string" && (AI_BUDGET_CATEGORIES as readonly string[]).includes(v);
}

export const CATEGORY_LABELS: Record<AiBudgetCategory, string> = {
  founder: "Founder tools",
  investor: "Investor tools",
  public: "Public site chat",
  internal: "Internal hubs",
  scheduled: "Scheduled jobs",
  enrichment: "Data enrichment",
  voice: "AI voice calls",
};

/** Which category and tool a paid call is billed to. */
export type AiUsageTag = { category: AiBudgetCategory; feature: string };

/** Display label and, for internal hubs, the hub group. Unknown keys show as the raw key. */
export const AI_FEATURE_META: Record<string, { label: string; group?: string }> = {
  // Founder tools
  pitch_deck_analyzer: { label: "Pitch deck analyzer" },
  market_claim_grader: { label: "Market claim grader" },
  diligence_report: { label: "Due diligence report" },
  valuation_advisor: { label: "Valuation advisor" },
  outreach_coach: { label: "Outreach coach" },
  round_health_advisor: { label: "Round health advisor" },
  business_plan: { label: "Business plan" },
  pitch_deck_draft: { label: "Pitch deck draft" },
  regcf_documents: { label: "Reg CF documents" },
  ir_report: { label: "IR report" },
  intro_note_drafts: { label: "Intro note drafts" },
  outreach_drafts: { label: "Outreach drafts" },
  class_assistant: { label: "Class assistant" },
  ai_coach: { label: "AI coach chat" },
  support_assistant: { label: "Support assistant" },
  document_summaries: { label: "Document summaries" },
  lesson_video_scripts: { label: "Lesson video scripts" },
  deal_room_drafts: { label: "Deal room drafts" },
  // Investor tools
  deal_brief: { label: "Deal brief" },
  watchlist_summary: { label: "Watchlist summary" },
  investor_coaching: { label: "Partner score coaching" },
  investor_journey: { label: "Journey coach" },
  // Public site
  site_chat: { label: "Site assistant and analysis" },
  event_assistant: { label: "Event page assistant" },
  // Internal hubs
  ceo_briefing: { label: "CEO briefing", group: "CEO Hub" },
  ceo_goals: { label: "Goal suggestions", group: "CEO Hub" },
  ceo_meetings: { label: "Meeting analysis", group: "CEO Hub" },
  ceo_phrase: { label: "Phrasing", group: "CEO Hub" },
  meetings: { label: "Meeting AI", group: "Meetings" },
  sales_assistant: { label: "Sales assistant", group: "Sales Hub" },
  sales_insights: { label: "Sales insights", group: "Sales Hub" },
  sales_forecast: { label: "Forecast insights", group: "Sales Hub" },
  marketing_cmo: { label: "CMO chat and plans", group: "Marketing and social" },
  marketing_copilot: { label: "Marketing copilot", group: "Marketing and social" },
  social_posts: { label: "Social post drafts", group: "Marketing and social" },
  email_compose: { label: "Email compose", group: "Marketing and social" },
  event_marketing: { label: "Event marketing", group: "Marketing and social" },
  operations_assistant: { label: "Operations assistant", group: "Operations" },
  metrics_explain: { label: "Metric explanations", group: "Operations" },
  ir_analytics: { label: "IR analytics", group: "Admin tools" },
  admin_company_ai: { label: "Company assessment and outreach", group: "Admin tools" },
  admin_investor_ai: { label: "Investor review and drafts", group: "Admin tools" },
  admin_support: { label: "Support reply drafts", group: "Admin tools" },
  admin_deal_rooms: { label: "Deal room summaries", group: "Admin tools" },
  admin_learning: { label: "Course and quiz generation", group: "Admin tools" },
  admin_crr: { label: "CRR advice", group: "Admin tools" },
  untagged: { label: "Other", group: "Admin tools" },
  // Scheduled
  ir_summaries: { label: "Daily IR summaries" },
  // Enrichment
  investor_enrichment: { label: "Investor enrichment" },
  web_search: { label: "Web search" },
  // Voice
  vapi_calls: { label: "Vapi call cost" },
  voice_agent: { label: "Claude voice agent" },
};

export function featureLabel(feature: string): string {
  return AI_FEATURE_META[feature]?.label ?? feature;
}

/**
 * List prices in USD per million tokens. Source: Claude API pricing page
 * (platform.claude.com/docs/en/about-claude/pricing), checked 2026-10-01.
 * Unknown models bill at the Sonnet rate so they are never undercounted.
 */
export const ANTHROPIC_PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
};
const FALLBACK_PRICE = { input: 3, output: 15 };

export function anthropicCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = ANTHROPIC_PRICES[model] ?? FALLBACK_PRICE;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

/**
 * Serper price per search. Serper's site states pricing from $0.30 per 1,000
 * queries, its lowest volume rate; smaller credit packs cost more per query.
 * Set SERPER_PRICE_PER_SEARCH_USD from your Serper invoice for an exact figure.
 */
export function serperCostPerSearch(): number {
  const v = Number(process.env.SERPER_PRICE_PER_SEARCH_USD);
  return Number.isFinite(v) && v > 0 ? v : 0.0003;
}

/** Alerts fire when spend first reaches these shares of a budget. */
export const ALERT_THRESHOLDS = [80, 100] as const;
