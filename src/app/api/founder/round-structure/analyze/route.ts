import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { gateAiRun } from "@/lib/ai-usage/gate";
import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "@/lib/claude";
import { analyzeOffering, summaryUsesOnlyKnownFigures } from "@/lib/founder/round-structure/analysis";

export const dynamic = "force-dynamic";

const inputsSchema = z.object({
  roundType: z.enum(["safe", "note", "priced"]),
  safeType: z.enum(["pre_money", "post_money"]),
  preMoney: z.number().min(0).max(1_000_000_000),
  raiseAmount: z.number().min(0).max(1_000_000_000),
  optionPoolPct: z.number().min(0).max(50),
  discountPct: z.number().min(0).max(50),
  interestPct: z.number().min(0).max(30),
  maturityMonths: z.number().int().min(1).max(60),
  warrantPct: z.number().min(0).max(100),
});

const SYSTEM_PROMPT = `You explain a startup founder's offering structure analysis in plain words.

You are given the analysis as facts: rows that compare the founder's terms with published benchmarks, and findings. Write a short summary of 3 to 5 sentences.

Rules:
- Use only the figures that appear in the facts. Never add, estimate or round to a new number, and never name a statistic that is not in the facts.
- Start with the single biggest flag. If nothing is flagged, say the structure sits in line with the benchmarks.
- Where a row says "No dataset", say that no benchmark exists. Do not fill the gap.
- Say which group a figure describes when you quote a benchmark.
- Do not give legal, tax or investment advice, and do not tell the founder what to sign.
- Do not use dashes or hyphens as punctuation. Use commas, colons or full stops.
- Return plain text only.`;

/**
 * The analysis itself runs in the browser from the sourced benchmark library, so the report
 * always appears instantly. This route only asks the AI to put the same facts into words.
 * It drafts text and writes nothing. Any figure outside the analysis causes the text to be
 * discarded, so the AI can explain the numbers but never add one.
 */
export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const parsed = inputsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid round inputs." }, { status: 400 });

  // Recomputed here so the AI only ever sees figures this server produced.
  const analysis = analyzeOffering(parsed.data);

  if (!isClaudeConfigured()) return NextResponse.json({ summary: null, source: "unavailable" });

  const facts = {
    terms: analysis.inputsSummary,
    ownershipAfterRound: analysis.ownership,
    rows: analysis.rows.map((r) => ({ label: r.label, you: r.you, benchmark: r.bench ?? "No dataset", change: r.delta, status: r.statusLabel, group: r.population })),
    findings: analysis.findings.map((f) => ({ title: f.title, data: f.data, meaning: f.means })),
  };

  try {
    const aiRun = await gateAiRun(auth.profile.id, "round_structure_analysis");
    if (aiRun.blocked) return aiRun.blocked;
    const raw = await aiRun.run(() => claudeComplete(
      [{ role: "user", content: `Facts:\n${JSON.stringify(facts)}\n\nWrite the summary.` }],
      { usage: { category: "founder", feature: "round_structure_analysis" }, model: CLAUDE_SONNET, maxTokens: 500, system: SYSTEM_PROMPT },
    ));
    await aiRun.done();

    const summary = raw.trim();
    if (!summary || !summaryUsesOnlyKnownFigures(summary, analysis.allowedFigures) || /[–—]| - /.test(summary)) {
      return NextResponse.json({ summary: null, source: "rejected" });
    }
    return NextResponse.json({ summary, source: "claude" });
  } catch (err) {
    console.error("Round structure analysis AI error:", err);
    return NextResponse.json({ summary: null, source: "unavailable" });
  }
}
