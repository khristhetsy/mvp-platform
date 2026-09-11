/**
 * AI CMO advisor for the Social Media Hub. Staff-only.
 *   POST { tab, question?, context } → { advice, degraded }
 *
 * `context` is a compact snapshot of what the current tab shows (funnel stages, pacing,
 * top movers…). The advisor is a marketing-leader persona that reads it and returns a
 * short, action-oriented tip. Falls back to a deterministic rule-based tip when
 * ANTHROPIC_API_KEY is absent, so the UI always has something useful to show.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { claudeComplete, isClaudeConfigured, CLAUDE_HAIKU } from "@/lib/claude";

export const dynamic = "force-dynamic";

const schema = z.object({
  tab: z.string().max(40),
  question: z.string().max(500).optional(),
  // Free-form snapshot the client assembles from what's on screen.
  context: z.record(z.string(), z.unknown()).optional(),
});

const SYSTEM = [
  "You are the AI CMO inside a B2B SaaS social-media hub for a fintech (iCapOS) that matches startup founders with investors.",
  "The funnel is Outreach → Impressions → Clicks → Meetings → Conversions; revenue is monthly subscription value of members that convert.",
  "Give one concrete, prioritized recommendation in 2-3 sentences. Be specific to the numbers in the context. Name the weakest step and one action to fix it.",
  "Never invent metrics not present in the context. No preamble, no markdown headings, no bullet lists — just the advice.",
].join(" ");

/** Deterministic fallback: find the weakest step / lowest attainment and advise. */
function fallbackTip(context: Record<string, unknown> | undefined): string {
  const stages = (context?.stages as Array<{ stage: string; pctOfGoal: number | null; deltaPct: number | null }> | undefined) ?? [];
  const withGoal = stages.filter((s) => typeof s.pctOfGoal === "number");
  if (withGoal.length) {
    const worst = withGoal.reduce((a, b) => ((b.pctOfGoal ?? 100) < (a.pctOfGoal ?? 100) ? b : a));
    const dropping = stages.filter((s) => typeof s.deltaPct === "number" && (s.deltaPct ?? 0) < 0).map((s) => s.stage);
    const dropNote = dropping.length ? ` ${dropping.join(" and ")} ${dropping.length > 1 ? "are" : "is"} down vs last period — likely a targeting or CTA issue.` : "";
    return `${worst.stage} is your furthest from goal at ${worst.pctOfGoal}%. Focus effort there before adding top-of-funnel volume.${dropNote}`;
  }
  return "Set a goal on each funnel stage so I can tell you where you're behind. Start with Conversions and Meetings — those tie most directly to revenue.";
}

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  if (!isClaudeConfigured()) {
    return NextResponse.json({ advice: fallbackTip(parsed.data.context), degraded: true });
  }
  try {
    const user = [
      `Tab: ${parsed.data.tab}.`,
      parsed.data.question ? `Question: ${parsed.data.question}` : "Give the single highest-leverage recommendation for what's on this tab.",
      `Context JSON:\n${JSON.stringify(parsed.data.context ?? {}).slice(0, 6000)}`,
    ].join("\n");
    const advice = await claudeComplete([{ role: "user", content: user }], { model: CLAUDE_HAIKU, system: SYSTEM, maxTokens: 400, temperature: 0.3 });
    return NextResponse.json({ advice: advice || fallbackTip(parsed.data.context), degraded: false });
  } catch {
    return NextResponse.json({ advice: fallbackTip(parsed.data.context), degraded: true });
  }
}
