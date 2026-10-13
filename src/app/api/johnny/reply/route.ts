import { NextResponse } from "next/server";
import { z } from "zod";
import { JOHNNY_SYSTEM_PROMPT } from "@/lib/johnny/config";
import { parseJohnnyReply } from "@/lib/johnny/profile";
import { violatesGuardrails } from "@/lib/ai-site/guardrails";
import { checkRateLimitAsync } from "@/lib/ai-site/ratelimit";
import { assertAiBudget, isAiBudgetExceeded, recordAiSpend } from "@/lib/ai-budget/service";
import { anthropicCostUsd } from "@/lib/ai-budget/config";

export const runtime = "edge";

/**
 * Johnny's AI reply (icapos.com/johnny). Public, so it is rate limited like
 * Jessica's and the marketing-site AI proxy, and billed to the "public" AI
 * budget. The page runs the conversation (options, booking, fixed answers);
 * this route writes the reply and reads the investor fields out of the chat,
 * under the fact sheet and rules in JOHNNY_SYSTEM_PROMPT.
 *
 * Runs on iCFO's own ANTHROPIC_API_KEY, so visitors are never asked to allow
 * anything. When the key is missing, the budget is spent, or the answer breaks
 * a rule, the page writes the reply from its own scripts instead.
 */
const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 300;

const requestSchema = z.object({
  mode: z.enum(["chat", "confirm", "times", "name", "email", "phone", "done"]),
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

/** Johnny must never put a price, a percentage or an invented dollar figure in front of a visitor. */
const PERCENT = /\d\s?%|\bpercent\b|\bper (month|mo|year)\b/i;

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

async function callAnthropic(system: string, messages: { role: "user" | "assistant"; content: string }[]): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error("[johnny] ANTHROPIC_API_KEY is not set");
    return null;
  }
  try {
    await assertAiBudget("public", anthropicCostUsd(MODEL, Math.ceil((system.length + JSON.stringify(messages).length) / 4), MAX_TOKENS));
  } catch (e) {
    if (isAiBudgetExceeded(e)) return null;
    throw e;
  }
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system, messages }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[johnny] Anthropic API ${res.status}: ${detail.slice(0, 500)}`);
    return null;
  }
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
  await recordAiSpend({
    vendor: "anthropic",
    category: "public",
    feature: "johnny_chat",
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
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  const { mode, known, missing, turns, sessionId } = parsed.data;
  if (turns[turns.length - 1].role !== "user") return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });

  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "0.0.0.0").trim();
  const limit = await checkRateLimitAsync({ ip, sessionId: sessionId ?? null });
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
  }

  // State rides on the last user turn: the mode, what is known, what is missing.
  const state =
    `PAGE MODE: ${mode}${mode === "chat" ? "" : " (the page is not discovering now: answer the visitor's message in one or two lines and do not ask profile questions)"}\n` +
    `KNOWN so far: ${JSON.stringify(known)}\nSTILL MISSING: ${missing.join(", ") || "nothing"}\n\n`;
  const messages = turns.map((t, i) => (i === turns.length - 1 ? { ...t, content: `${state}${t.content}` } : t));

  const text = await callAnthropic(JOHNNY_SYSTEM_PROMPT, messages);
  if (!text) return NextResponse.json({ ok: false, error: "AI is unavailable right now." }, { status: 503 });

  // Dollar figures may only repeat what the visitor typed (or tapped).
  const visitor = turns.filter((t) => t.role === "user").map((t) => t.content).join(" ");
  const allowedMoney = visitor.toLowerCase().replace(/[\s,]/g, "");
  const reply = parseJohnnyReply(extractJson(text), allowedMoney, visitor);
  if (!reply) return NextResponse.json({ ok: false, error: "Could not produce a valid response." }, { status: 502 });

  // Server-side backstop. The prompt says no prices and no promises; never trust it alone.
  const everything = reply.lines.join(" ");
  if (violatesGuardrails(everything) || PERCENT.test(everything)) return NextResponse.json({ ok: false, error: "Guardrail." }, { status: 502 });

  return NextResponse.json({ ok: true, ...reply });
}
