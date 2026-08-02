import { z } from "zod";

/**
 * AI task enum, token caps, and Zod contracts for the marketing-site AI proxy
 * (spec §7.1, §7.4). The client supplies a `task` from this enum — never a
 * system prompt. Each JSON task's output is validated server-side before it
 * reaches the client; malformed → retry once → fallback UI state.
 */

export const AI_TASKS = ["assistant", "analyze_readiness", "parse_mandate", "draft_onepager", "nudge", "confirm_demo"] as const;
export type AiTask = (typeof AI_TASKS)[number];

/** Per-task max_tokens (spec §7.1). */
export const MAX_TOKENS: Record<AiTask, number> = {
  assistant: 600,
  analyze_readiness: 900,
  parse_mandate: 400,
  draft_onepager: 700,
  nudge: 200,
  confirm_demo: 300,
};

/** Tasks whose responses stream to the UI; JSON tasks are non-streaming (§7.1). */
export const STREAMING_TASKS: ReadonlySet<AiTask> = new Set<AiTask>(["assistant", "nudge"]);

/** Conversation validation (spec §7.1): ≤12 turns, ≤4,000 chars/message, roles
 *  restricted to user/assistant. */
export const messagesSchema = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(4000),
    }),
  )
  .min(1)
  .max(12);

export const requestSchema = z.object({
  task: z.enum(AI_TASKS),
  messages: messagesSchema,
  context: z.record(z.string(), z.unknown()).optional(),
});
export type AiRequest = z.infer<typeof requestSchema>;

// ── Filter enums for parse_mandate (constrained per §7.4). These must mirror the
// MatchExplorer filter options in the mock — align when the mock lands. ──────────
export const SECTOR_ENUM = ["software", "fintech", "healthcare", "consumer", "deeptech", "climate", "industrials", "other"] as const;
export const STAGE_ENUM = ["pre_seed", "seed", "series_a", "series_b", "growth", "other"] as const;
export const CHECK_ENUM = ["under_50k", "50k_250k", "250k_1m", "1m_5m", "5m_plus"] as const;

// ── Output contracts (§7.4) ──────────────────────────────────────────────────
export const ASSISTANT_CARDS = ["none", "readiness", "pricing", "demo", "events", "match", "founders", "investors"] as const;

export const assistantOutput = z.object({
  say: z.string().min(1),
  role: z.enum(["founder", "investor", "unknown"]),
  card: z.enum(ASSISTANT_CARDS),
  chips: z.array(z.string()).max(6),
});
export type AssistantOutput = z.infer<typeof assistantOutput>;

export const analyzeReadinessOutput = z.object({
  narrative: z.number().min(0).max(100),
  financial: z.number().min(0).max(100),
  traction: z.number().min(0).max(100),
  captable: z.number().min(0).max(100),
  team: z.number().min(0).max(100),
  summary: z.string().min(1),
  fixes: z.array(z.object({ area: z.string(), action: z.string() })).max(8),
});
export type AnalyzeReadinessOutput = z.infer<typeof analyzeReadinessOutput>;

export const parseMandateOutput = z.object({
  sector: z.enum(SECTOR_ENUM),
  stage: z.enum(STAGE_ENUM),
  check: z.enum(CHECK_ENUM),
  read: z.string().min(1),
});
export type ParseMandateOutput = z.infer<typeof parseMandateOutput>;

/** The JSON-contract tasks (validated with the schemas above). The others
 *  (assistant/nudge stream free text, confirm_demo/draft_onepager return prose). */
export const JSON_OUTPUT: Partial<Record<AiTask, z.ZodTypeAny>> = {
  assistant: assistantOutput,
  analyze_readiness: analyzeReadinessOutput,
  parse_mandate: parseMandateOutput,
};
