import { NextResponse } from "next/server";
import { z } from "zod";
import { JESSICA_SYSTEM_PROMPT } from "@/lib/jessica/config";
import { parseAiReply } from "@/lib/jessica/flow";
import { violatesGuardrails } from "@/lib/ai-site/guardrails";
import { checkRateLimitAsync } from "@/lib/ai-site/ratelimit";
import { assertAiBudget, isAiBudgetExceeded, recordAiSpend } from "@/lib/ai-budget/service";
import { anthropicCostUsd } from "@/lib/ai-budget/config";

export const runtime = "edge";

/**
 * Jessica's AI reply (icapos.com/jessica). Public, so it is rate limited like
 * the marketing-site AI proxy and billed to the "public" AI budget. Fees,
 * objections and booking are scripted on the page; this route only answers the
 * long tail, under the fact sheet and rules in JESSICA_SYSTEM_PROMPT.
 *
 * Runs on iCFO's own ANTHROPIC_API_KEY, so visitors are never asked to allow
 * anything. When the key is missing, the budget is spent, or the answer trips a
 * guardrail, the page shows its scripted fallback instead.
 */
const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 220;

const requestSchema = z.object({
  mode: z.enum(["CLOSE", "QUALIFY", "DONE"]),
  turns: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(600) }))
    .min(1)
    .max(12),
  sessionId: z.string().max(80).optional(),
});

/** Jessica must never put a price, a percentage or a dollar figure in front of a visitor. */
const MONEY_OR_PERCENT = /\$\s?\d|\d\s?%|\bpercent\b|\b\d{1,3}(,\d{3})+\b|\bper (month|mo|year)\b/i;

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

async function callAnthropic(messages: { role: "user" | "assistant"; content: string }[]): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error("[jessica] ANTHROPIC_API_KEY is not set");
    return null;
  }
  try {
    await assertAiBudget("public", anthropicCostUsd(MODEL, Math.ceil((JESSICA_SYSTEM_PROMPT.length + JSON.stringify(messages).length) / 4), MAX_TOKENS));
  } catch (e) {
    if (isAiBudgetExceeded(e)) return null;
    throw e;
  }
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system: JESSICA_SYSTEM_PROMPT, messages }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[jessica] Anthropic API ${res.status}: ${detail.slice(0, 500)}`);
    return null;
  }
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
  await recordAiSpend({
    vendor: "anthropic",
    category: "public",
    feature: "jessica_chat",
    model: MODEL,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    costUsd: anthropicCostUsd(MODEL, data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0),
  });
  return (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim() || null;
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const { mode, turns, sessionId } = parsed.data;
  if (turns[turns.length - 1].role !== "user") {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "0.0.0.0").trim();
  const limit = await checkRateLimitAsync({ ip, sessionId: sessionId ?? null });
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
  }

  // The mode rides on the last user turn, the way the prompt describes it.
  const messages = turns.map((t, i) => (i === turns.length - 1 ? { ...t, content: `MODE=${mode}\n${t.content}` } : t));

  const text = await callAnthropic(messages);
  if (!text) return NextResponse.json({ ok: false, error: "AI is unavailable right now." }, { status: 503 });

  const reply = parseAiReply(extractJson(text));
  if (!reply) return NextResponse.json({ ok: false, error: "Could not produce a valid response." }, { status: 502 });

  // Server-side backstop. The prompt says no prices and no promises; never trust it alone.
  const everything = [...reply.lines, reply.bridge, reply.question].join(" ");
  if (violatesGuardrails(everything) || MONEY_OR_PERCENT.test(everything)) {
    return NextResponse.json({ ok: false, error: "Guardrail." }, { status: 502 });
  }
  if (mode !== "CLOSE") reply.bridge = "";
  if (mode !== "QUALIFY") reply.question = "";

  return NextResponse.json({ ok: true, ...reply });
}
