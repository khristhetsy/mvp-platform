import { NextResponse } from "next/server";
import { requestSchema, MAX_TOKENS, JSON_OUTPUT, type AiTask } from "@/lib/ai-site/tasks";
import { systemPromptFor } from "@/lib/ai-site/prompts";
import { violatesGuardrails, GUARDRAIL_FALLBACK } from "@/lib/ai-site/guardrails";
import { checkRateLimit } from "@/lib/ai-site/ratelimit";

export const runtime = "edge";

const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

/** One Anthropic call → assistant text (edge-compatible fetch, no SDK). */
async function callAnthropic(system: string, messages: { role: string; content: string }[], maxTokens: number): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim() || null;
}

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

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { task, messages, context } = parsed.data;

  // Rate limit (spec §7.2).
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "0.0.0.0").trim();
  const sessionId = (context?.sessionId as string | undefined) ?? req.headers.get("x-ai-session") ?? null;
  const limit = checkRateLimit({ ip, sessionId });
  if (!limit.ok) {
    const msg = limit.reason === "resting"
      ? "Our AI is resting for now — please try again a little later."
      : "You've hit the request limit. Please try again shortly.";
    return NextResponse.json({ error: msg, resting: limit.reason === "resting" }, {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSec) },
    });
  }

  const system = systemPromptFor(task);
  const maxTokens = MAX_TOKENS[task];
  const contract = JSON_OUTPUT[task as AiTask];

  // JSON-contract tasks: validate, retry once, then fallback.
  if (contract) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await callAnthropic(system, messages, maxTokens);
      if (!text) break;
      const json = extractJson(text);
      const valid = json ? contract.safeParse(json) : null;
      if (valid?.success) {
        // Guardrail the user-facing text field where present.
        const data = valid.data as Record<string, unknown>;
        const say = typeof data.say === "string" ? data.say : null;
        if (say && violatesGuardrails(say)) {
          return NextResponse.json({ ok: true, data: { ...data, say: GUARDRAIL_FALLBACK } });
        }
        return NextResponse.json({ ok: true, data });
      }
    }
    return NextResponse.json({ ok: false, error: "Could not produce a valid response." }, { status: 502 });
  }

  // Free-text tasks (nudge, draft_onepager, confirm_demo).
  const text = await callAnthropic(system, messages, maxTokens);
  if (!text) {
    return NextResponse.json({ ok: false, error: "AI is unavailable right now." }, { status: 503 });
  }
  if (violatesGuardrails(text)) {
    return NextResponse.json({ ok: true, text: GUARDRAIL_FALLBACK });
  }
  return NextResponse.json({ ok: true, text });
}
