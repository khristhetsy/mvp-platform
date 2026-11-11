import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { claudeComplete, isClaudeConfigured, CLAUDE_HAIKU } from "@/lib/claude";
import { taughtAnswerFor } from "@/lib/ir-agent/scripted";
import { loadPricing } from "@/lib/subscriptions/pricing-server";
import { HANDOFF_TAG, buildSystem } from "@/lib/support/assistant-prompt";
import { loadAssistantTraining } from "@/lib/support/assistant-training";

export const dynamic = "force-dynamic";

const schema = z.object({ question: z.string().trim().min(2).max(1000) });

type Source = "taught" | "ai" | "handoff" | "offline";

/**
 * Ask the support assistant as a founder would, before anything goes live. It
 * uses the same prompt and the same order as the real assistant (taught answer
 * first, then the AI), and says which one answered. It opens no request and
 * writes nothing to the support log.
 */
export async function POST(req: Request): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Type a question to test." }, { status: 400 });
  const { question } = parsed.data;

  const training = await loadAssistantTraining();
  const hit = taughtAnswerFor(question, training.taught);
  if (hit) return NextResponse.json({ reply: hit.answer, source: "taught" satisfies Source });

  if (!isClaudeConfigured()) return NextResponse.json({ reply: "The AI is not configured here, so only taught answers can be tested.", source: "offline" satisfies Source });

  const system = buildSystem({ name: "Test founder", company: null, stage: null, plan: null, pricing: await loadPricing(), training });
  try {
    const reply = await claudeComplete([{ role: "user", content: question }], {
      usage: { category: "internal", feature: "support_assistant" },
      model: CLAUDE_HAIKU,
      system,
      maxTokens: 700,
      temperature: 0.3,
    });
    if (reply.trim().startsWith(HANDOFF_TAG)) {
      const topic = reply.trim().slice(HANDOFF_TAG.length).trim().slice(0, 80);
      return NextResponse.json({ reply: `Would hand off to a person. Topic: ${topic || "needs a person"}.`, source: "handoff" satisfies Source });
    }
    return NextResponse.json({ reply: reply || "No answer came back. Try rephrasing.", source: "ai" satisfies Source });
  } catch {
    return NextResponse.json({ error: "The AI could not answer just now. Try again." }, { status: 502 });
  }
}
