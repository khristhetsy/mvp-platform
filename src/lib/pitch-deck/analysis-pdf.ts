// Pitch deck analysis → PDF on the shared report kit (same masthead, tables
// and footer as the diligence and portfolio reports).

import type { PitchDeckAnalysis } from "@/app/api/founder/pitch-deck-analyze/route";
import { createCanvas, docToBuffer, masthead, newReportDoc } from "@/lib/diligence/pdf-primitives";
import type { Section, Tone } from "@/lib/diligence/report-model";

const VERDICT: Record<string, { label: string; tone: Tone }> = {
  strong: { label: "Strong", tone: "good" },
  good: { label: "Good", tone: "low" },
  needs_work: { label: "Needs work", tone: "medium" },
  missing: { label: "Missing", tone: "high" },
};

export function renderPitchDeckAnalysisPdf(analysis: PitchDeckAnalysis, companyName: string, now = new Date()): Promise<Buffer> {
  const doc = newReportDoc(`Pitch Deck Analysis · ${companyName}`);
  const generated = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return docToBuffer(doc, () => {
    const c = createCanvas(doc);
    masthead(c, {
      title: "Pitch Deck Analysis",
      subtitle: `${companyName} · AI review from a simulated investor view`,
      meta: [["Overall score", `${analysis.overallScore} / 100`], ["Generated", generated]],
    });

    const scored = analysis.sections.filter((x) => x.verdict !== "missing");
    c.tiles([
      { value: `${analysis.overallScore}`, label: "Overall score out of 100", alert: analysis.overallScore < 50 },
      { value: String(analysis.sections.filter((x) => x.verdict === "strong").length), label: "Strong sections" },
      { value: String(analysis.sections.filter((x) => x.verdict === "needs_work" || x.verdict === "missing").length), label: "Sections to fix" },
      { value: String(scored.length), label: `Sections reviewed of ${analysis.sections.length}` },
    ]);

    const sections: Section[] = [
      { key: "verdict", title: "Overall verdict", paragraphs: [analysis.overallVerdict] },
      { key: "reaction", title: "Simulated investor first impression", paragraphs: [analysis.investorReaction] },
      ...(analysis.topStrengths.length ? [{ key: "strengths", title: "Top strengths", paragraphs: analysis.topStrengths.map((x) => `•  ${x}`) }] : []),
      ...(analysis.topGaps.length ? [{ key: "gaps", title: "Top gaps", paragraphs: analysis.topGaps.map((x) => `•  ${x}`) }] : []),
      {
        key: "sections",
        title: "Section by section",
        table: {
          columns: [
            { label: "Section", width: 0.6 },
            { label: "Score", width: 0.2, align: "right", mono: true },
            { label: "Verdict", width: 0.2, align: "right" },
          ],
          rows: analysis.sections.map((x) => {
            const v = VERDICT[x.verdict] ?? { label: x.verdict, tone: "neutral" as Tone };
            return [x.name, `${x.score}/100`, { pill: v.label, tone: v.tone }];
          }),
        },
        notes: analysis.sections.map((x) => ({ heading: x.name, lines: [x.feedback, `Quick fix: ${x.tip}`] })),
      },
    ];
    c.sections(sections, 1);

    c.finish({
      left: `iCapOS · Pitch Deck Analysis · ${companyName}`,
      right: generated,
      footer: "Informational only, not investment advice. AI-generated feedback from a simulated investor perspective.",
    });
  });
}

