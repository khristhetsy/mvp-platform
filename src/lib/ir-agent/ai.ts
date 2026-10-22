/**
 * The AI reply for an IR agent, with the same protections Johnny's route has:
 *   1. rate limit per IP and session (checkRateLimitAsync), before the model
 *   2. public AI budget check (assertAiBudget), before the model
 *   3. spend recording (recordAiSpend), after the model
 *   4. guardrails and the no percentages rule, on the reply
 * Edge safe: no Node APIs. Johnny's own route is untouched; founder agents use this.
 */
import { z } from "zod";
import { AGENT_TYPE_SPECS, DEFAULT_AGENT_TYPE, type AgentType } from "./agent-types";
import { parseJohnnyReply, type JohnnyAiReply } from "@/lib/johnny/profile";
import { violatesGuardrails } from "@/lib/ai-site/guardrails";
import { checkRateLimitAsync } from "@/lib/ai-site/ratelimit";
import { assertAiBudget, isAiBudgetExceeded, recordAiSpend } from "@/lib/ai-budget/service";
import { anthropicCostUsd } from "@/lib/ai-budget/config";

export const AGENT_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 300;

/** The agent must never put a price, a percentage or an invented dollar figure in front of a visitor. */
export const PERCENT = /\d\s?%|\bpercent\b|\bper (month|mo|year)\b/i;

export const replyRequestSchema = z.object({
  mode: z.enum(["chat", "confirm", "times", "contact", "done"]),
  known: z.object({
    investor_type: z.string().max(40).nullable(),
    check_size_min: z.number().nullable(),
    check_size_max: z.number().nullable(),
    preferred_sectors: z.array(z.string().max(40)).max(10),
    preferred_stages: z.array(z.string().max(20)).max(6),
    capital_types: z.array(z.string().max(20)).max(4),
  }),
  missing: z.array(z.string().max(30)).max(5),
  turns: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(600) }))
    .min(1)
    .max(15),
  sessionId: z.string().max(80).optional(),
});
export type ReplyRequest = z.infer<typeof replyRequestSchema>;

export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "0.0.0.0").trim();
}

/** Rate limit, then budget, then the model, then spend. Null when any step says no. */
export async function callAgentModel(input: { system: string; messages: { role: "user" | "assistant"; content: string }[]; feature: string; tag: string }): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error(`[${input.tag}] ANTHROPIC_API_KEY is not set`);
    return null;
  }
  try {
    await assertAiBudget("public", anthropicCostUsd(AGENT_MODEL, Math.ceil((input.system.length + JSON.stringify(input.messages).length) / 4), MAX_TOKENS));
  } catch (e) {
    if (isAiBudgetExceeded(e)) return null;
    throw e;
  }
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: AGENT_MODEL, max_tokens: MAX_TOKENS, system: input.system, messages: input.messages }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[${input.tag}] Anthropic API ${res.status}: ${detail.slice(0, 500)}`);
    return null;
  }
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
  await recordAiSpend({
    vendor: "anthropic",
    category: "public",
    feature: input.feature,
    model: AGENT_MODEL,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    costUsd: anthropicCostUsd(AGENT_MODEL, data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0),
  });
  return (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim() || null;
}

export type AgentReplyResult =
  | { ok: true; reply: JohnnyAiReply }
  | { ok: false; status: 400 | 429 | 502 | 503; error: string; retryAfterSec?: number };

/**
 * One validated request in, one checked reply out. The state (mode, known,
 * missing) rides on the last user turn, exactly as Johnny does it.
 */
export async function agentReply(req: Request, body: ReplyRequest, system: string, feature: string, tag: string): Promise<AgentReplyResult> {
  const { mode, known, missing, turns, sessionId } = body;
  if (turns[turns.length - 1].role !== "user") return { ok: false, status: 400, error: "Invalid request." };

  const limit = await checkRateLimitAsync({ ip: clientIp(req), sessionId: sessionId ?? null });
  if (!limit.ok) return { ok: false, status: 429, error: "Too many requests.", retryAfterSec: limit.retryAfterSec };

  const state =
    `PAGE MODE: ${mode}${mode === "chat" ? "" : " (the page is not discovering now: answer the visitor's message in one or two lines and do not ask profile questions)"}\n` +
    `KNOWN so far: ${JSON.stringify(known)}\nSTILL MISSING: ${missing.join(", ") || "nothing"}\n\n`;
  const messages = turns.map((t, i) => (i === turns.length - 1 ? { ...t, content: `${state}${t.content}` } : t));

  const text = await callAgentModel({ system, messages, feature, tag });
  if (!text) return { ok: false, status: 503, error: "AI is unavailable right now." };

  // Dollar figures may only repeat what the visitor typed (or tapped).
  const visitor = turns.filter((t) => t.role === "user").map((t) => t.content).join(" ");
  const allowedMoney = visitor.toLowerCase().replace(/[\s,]/g, "");
  const reply = parseJohnnyReply(extractJson(text), allowedMoney, visitor);
  if (!reply) return { ok: false, status: 502, error: "Could not produce a valid response." };

  // Server side backstop. The prompt says no prices and no promises; never trust it alone.
  const everything = reply.lines.join(" ");
  if (violatesGuardrails(everything) || PERCENT.test(everything)) return { ok: false, status: 502, error: "Guardrail." };

  return { ok: true, reply };
}

/** The fact sheet and rules for a founder's agent. Everything about the company comes from the founder. */
export function founderSystemPrompt(input: {
  displayName: string;
  companyName: string;
  about: string | null;
  taught: Array<{ question: string; answer: string }>;
  sources: string[];
  fieldsAsked: string[];
  agentType?: AgentType;
}): string {
  const facts = [
    input.about?.trim() ? `ABOUT ${input.companyName.toUpperCase()}:\n${input.about.trim().slice(0, 4000)}` : "",
    input.taught.length
      ? `ANSWERS THE FOUNDER WROTE (use these words when the question comes up):\n${input.taught
          .slice(0, 40)
          .map((t) => `Q: ${t.question.slice(0, 200)}\nA: ${t.answer.slice(0, 500)}`)
          .join("\n")}`
      : "",
    input.sources.length ? `FROM THE COMPANY'S DOCUMENTS:\n${input.sources.join("\n\n").slice(0, 12000)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const spec = AGENT_TYPE_SPECS[input.agentType ?? DEFAULT_AGENT_TYPE];
  const asked = input.fieldsAsked.length ? input.fieldsAsked.join(", ") : "investor type, check size, industries, stages, capital types";
  const goal = spec.goal.replace("{asked}", asked);

  return `You are ${input.displayName}, the ${spec.role} for ${input.companyName}. You write to a visitor on the company's behalf. Your job is a real, friendly conversation: ${goal}. You are not iCFO Capital Global and you do not speak for iCapOS; you speak for ${input.companyName} only. iCapOS is the software this page runs on.

${facts || `You have no fact sheet yet. If asked about ${input.companyName}, say the founder covers that on the call.`}

HOW TO TALK: Sound like a person typing on a phone. One or two short lines, each under 18 words. Be courteous, prompt and precise: thank people when they share something and repeat their figures exactly as they gave them. React to what they actually said, in their own words, before you ask anything. Ask at most one question per turn, only about something still missing, and tie it to what they just said. Accept answers in any order and acknowledge everything they volunteer. If they ask about the company, answer only from the facts above, then keep going naturally. If the facts do not cover it, say the founder covers that on the call. Never run down a checklist. Never ask something they already answered. Never use the same wording twice. If they sound impatient or ask for less, stop asking and set ready to true.

RULES: Never quote any price, valuation, fee, percentage, discount, revenue figure or round size unless it is written in the facts above word for word. Never promise or imply funding, returns or results. Never give investment, legal or tax advice. Never invent names, numbers, dates, customers or investors. Speak as we and our about ${input.companyName}. Never volunteer that you are an AI. No dashes, no bullet points, no emojis. Do not offer call times and never ask whether they want a call: the page does that.

Reply ONLY with JSON: {"lines":["line 1"],"fields":{"investor_type":null,"check_size_min":null,"check_size_max":null,"preferred_sectors":[],"preferred_stages":[],"capital_types":[]},"ask":"none","ready":false}. lines: one or two short lines. fields: only what the visitor has said so far in this conversation; investor_type is one of Individual angel, Angel group / syndicate, Family office, Venture fund, Corporate / strategic, Other; preferred_stages come from Pre-seed, Seed, Series A, Series B, Growth; capital_types come from Equity, SAFE, Convertible note, Venture debt, Revenue-based; preferred_sectors are industry names as the investor says them; check sizes are whole US dollars. ask: the field your question is about (investor_type, check_size, preferred_sectors, preferred_stages, capital_types) or none. ready: true when you know enough, or the visitor wants to move on, and you are NOT asking a question.`;
}
