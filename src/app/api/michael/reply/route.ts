import { NextResponse } from "next/server";
import { z } from "zod";
import { MICHAEL_SYSTEM_PROMPT } from "@/lib/michael/config";
import { parseAiReply } from "@/lib/jessica/flow";
import { violatesGuardrails } from "@/lib/ai-site/guardrails";
import { checkRateLimitAsync } from "@/lib/ai-site/ratelimit";
import { assertAiBudget, isAiBudgetExceeded, recordAiSpend } from "@/lib/ai-budget/service";
import { anthropicCostUsd } from "@/lib/ai-budget/config";

export const runtime = "edge";

/**
 * The Michael chat's AI reply (icapos.com/michael). Same guardrails, rate limit
 * and "public" AI budget as Jessica's route, with the Michael prompt.
 *
 * Runs on iCFO's own ANTHROPIC_API_KEY. When the key is missing, the budget is
 * spent, or the answer trips a guardrail, the page uses its written lines.
 */
const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 220;

const turnSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(600) });

const requestSchema = z.object({
  mode: z.enum(["CLOSE", "QUALIFY", "BREATHE", "ASIDE", "DONE"]),
  known: z.string().max(600).optional(),
  turns: z.array(turnSchema).min(1).max(13),
  sessionId: z.string().max(80).optional(),
});

/** No price, percentage or dollar figure in front of a visitor. "7,000" (the investor network) is the one number allowed. */
const MONEY_OR_PERCENT = /\$\s?\d|\d\s?%|\bpercent\b|\b\d{1,3}(,\d{3})+\b|\bper (month|mo|year)\b/i;
const allowedNumbers = (s: string) => s.replace(/\b7,000\b/g, "seven thousand");

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callAnthropic(systemPrompt: string, messages: { role: "user" | "assistant"; content: string }[]): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error("[michael] ANTHROPIC_API_KEY is not set");
    return null;
  }
  try {
    await assertAiBudget("public", anthropicCostUsd(MODEL, Math.ceil((systemPrompt.length + JSON.stringify(messages).length) / 4), MAX_TOKENS));
  } catch (e) {
    if (isAiBudgetExceeded(e)) return null;
    throw e;
  }
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system: systemPrompt, messages }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[michael] Anthropic API ${res.status}: ${detail.slice(0, 500)}`);
    return null;
  }
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
  await recordAiSpend({
    vendor: "anthropic",
    category: "public",
    feature: "michael_chat",
    model: MODEL,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    costUsd: anthropicCostUsd(MODEL, data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0),
  });
  return (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim() || null;
}

const unsafe = (s: string) => violatesGuardrails(s) || MONEY_OR_PERCENT.test(allowedNumbers(s)) || /[–—]/.test(s);

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const { mode, known, turns, sessionId } = parsed.data;

  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "0.0.0.0").trim();
  const limit = await checkRateLimitAsync({ ip, sessionId: sessionId ?? null });
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
  }

  if (turns[turns.length - 1].role !== "user") {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  // The mode rides on the last user turn, the way the prompt describes it.
  const messages = turns.map((t, i) => (i === turns.length - 1 ? { ...t, content: `MODE=${mode}\n${t.content}` } : t));
  const system = MICHAEL_SYSTEM_PROMPT + (known ? `\nKNOWN about this visitor, never ask for these again: ${known}` : "");
  const text = await callAnthropic(system, messages);
  if (!text) return NextResponse.json({ ok: false, error: "AI is unavailable right now." }, { status: 503 });

  const reply = parseAiReply(extractJson(text));
  if (!reply) return NextResponse.json({ ok: false, error: "Could not produce a valid response." }, { status: 502 });

  // Server side backstop. The prompt says no prices and no promises; never trust it alone.
  if (unsafe([...reply.lines, reply.bridge, reply.question].join(" "))) {
    return NextResponse.json({ ok: false, error: "Guardrail." }, { status: 502 });
  }
  if (mode !== "CLOSE") reply.bridge = "";
  if (mode !== "QUALIFY" && mode !== "BREATHE") reply.question = "";

  return NextResponse.json({ ok: true, ...reply });
}
