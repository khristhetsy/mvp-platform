import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { claudeComplete, CLAUDE_SONNET, isClaudeConfigured } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const REWRITE: Record<string, string> = {
  formal: "more formal and polished, in a professional business tone",
  friendly: "warmer and friendlier while staying professional",
  persuasive: "more persuasive and compelling, with a clear, specific call to action",
  shorten: "significantly shorter and more concise, keeping only the key points",
  expand: "more detailed and fully fleshed out, adding helpful context where useful",
  polish: "corrected for spelling, grammar, and awkward phrasing — without changing the meaning or tone",
};

const schema = z.object({
  mode: z.enum(["draft", "rewrite"]),
  action: z.string().optional(),
  instruction: z.string().max(2000).optional(),
  currentText: z.string().max(8000).optional(),
  subject: z.string().max(300).optional(),
  to: z.string().max(300).optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJson(raw: string): any {
  try { const f = raw.match(/```(?:json)?\s*([\s\S]*?)```/); return JSON.parse((f ? f[1] : raw).trim()); } catch { return null; }
}

const SYSTEM = "You are the iCapOS email writing assistant for iCFO Capital Global. Write clear, warm, professional business emails. Never include a subject line inside the body, and never add a signature or sign-off name block — those are added separately by the app. Use short paragraphs separated by blank lines. Do not invent facts, figures, names, or commitments that weren't provided.";

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireRole(["admin", "analyst"]);
    if (!isClaudeConfigured()) {
      return NextResponse.json({ error: "AI writing is not configured (set ANTHROPIC_API_KEY)." }, { status: 503 });
    }
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const { mode, action, instruction, currentText, subject, to } = parsed.data;

    if (mode === "draft") {
      if (!instruction?.trim()) return NextResponse.json({ error: "Describe what the email should say." }, { status: 400 });
      const ctx = [
        `Recipient: ${to || "(unspecified)"}`,
        subject ? `Existing subject: ${subject}` : null,
        currentText?.trim() ? `Existing draft to build on:\n${currentText}` : null,
        `\nWrite the email. Instruction: ${instruction}`,
      ].filter(Boolean).join("\n");
      const out = await claudeComplete(
        [{ role: "user", content: `${ctx}\n\nOutput STRICT JSON: {"subject": string, "body": string}. The body is plain text (no subject, no signature).` }],
        { system: SYSTEM, model: CLAUDE_SONNET, maxTokens: 900, temperature: 0.6 },
      );
      const j = parseJson(out);
      if (j && typeof j.body === "string") {
        return NextResponse.json({ body: j.body.trim(), subject: typeof j.subject === "string" ? j.subject.trim() : null });
      }
      // Fallback: treat the whole reply as the body.
      return NextResponse.json({ body: out.trim(), subject: null });
    }

    // rewrite
    const how = action && REWRITE[action] ? REWRITE[action] : REWRITE.polish;
    if (!currentText?.trim()) return NextResponse.json({ error: "Write something first, then rewrite it." }, { status: 400 });
    const out = await claudeComplete(
      [{ role: "user", content: `Rewrite the email below to be ${how}. Preserve the intent. Output ONLY the rewritten email body as plain text — no subject, no signature, no preamble.\n\n---\n${currentText}` }],
      { system: SYSTEM, model: CLAUDE_SONNET, maxTokens: 1100, temperature: 0.5 },
    );
    return NextResponse.json({ body: out.trim() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "AI request failed." }, { status: 500 });
  }
}
