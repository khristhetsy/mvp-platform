import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "@/lib/claude";

const schema = z.object({
  questionId: z.string().uuid(),
  question: z.string().min(1).max(6000),
  category: z.string().min(1).max(100),
  companySnapshot: z.object({
    companyName: z.string(),
    industry: z.string().nullable().optional(),
    businessDescription: z.string().nullable().optional(),
    revenueStage: z.string().nullable().optional(),
    fundingAmount: z.number().nullable().optional(),
    geography: z.string().nullable().optional(),
  }),
});

const SYSTEM_PROMPT = `You are an expert startup advisor helping a founder respond to investor due diligence questions in a deal room.

Your job: write a clear, professional, factual response draft that the founder can customise with their real numbers.

Rules:
- Be specific and structured. Use numbers and metrics wherever relevant.
- Where the founder needs to fill in real data, wrap it in [square brackets], e.g. [your ARR], [X months runway].
- Keep the tone confident, direct, and founder-authentic — not corporate.
- Never give legal, tax, or investment advice. Stay educational and diligence-oriented.
- Aim for 3–5 sentences or 2–3 short paragraphs. No fluff, no preamble like "Great question!".
- End with an offer to share supporting documentation or schedule a deeper conversation.`;

export async function POST(
  request: Request,
  { params }: Readonly<{ params: Promise<{ roomId: string }> }>,
) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const { roomId } = await params;

  // Verify founder owns a company linked to this room
  const admin = createServiceRoleClient();
  const { data: room } = await admin
    .from("deal_rooms")
    .select("founder_id")
    .eq("id", roomId)
    .maybeSingle();

  if (!room || room.founder_id !== auth.profile.id) {
    return NextResponse.json({ error: "Deal room not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 400 });
  }

  const { question, category, companySnapshot } = parsed.data;
  const c = companySnapshot;

  if (!isClaudeConfigured()) {
    // Graceful fallback — return a structured template
    return NextResponse.json({
      draft: `[AI drafting is not configured — add ANTHROPIC_API_KEY to enable real AI responses.]\n\nThank you for this ${category} question. ${c.companyName} [provide your answer here]. Happy to share supporting documentation on request.`,
      source: "fallback",
    });
  }

  const contextLines = [
    `Company: ${c.companyName}`,
    c.industry ? `Industry: ${c.industry}` : null,
    c.businessDescription ? `Business: ${c.businessDescription}` : null,
    c.revenueStage ? `Stage: ${c.revenueStage}` : null,
    c.fundingAmount ? `Raising: $${c.fundingAmount.toLocaleString()}` : null,
    c.geography ? `Geography: ${c.geography}` : null,
  ].filter(Boolean).join("\n");

  const userMessage = `Company context:\n${contextLines}\n\nQuestion category: ${category}\nInvestor question: "${question}"\n\nWrite a response draft the founder can use as a starting point.`;

  try {
    const draft = await claudeComplete(
      [{ role: "user", content: userMessage }],
      { model: CLAUDE_SONNET, maxTokens: 600, system: SYSTEM_PROMPT },
    );
    return NextResponse.json({ draft, source: "claude" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI draft generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
