// AI review of a Spotlight pitch against the iCFO standard, and the short AI
// intro read before each pitch. AI drafts and recommends; staff decide.
//
// Claude cannot watch video. The review reads the transcript (YouTube's free
// automatic captions, pasted by staff) plus the free file checks measured on
// upload. Cost bills to the existing AI budget (Internal hubs category).

import { claudeComplete } from "@/lib/claude";
import { PITCH_OUTLINE, type PitchPartId, checkSpotlightFile, type FileCheck } from "./rules";

export type ReviewStatus = "pass" | "warn" | "fail";
export type ComplianceFlag = { quote: string; why: string };
export type SpotlightRecommendation = "approve" | "request_change" | "decline";

export type SpotlightReview = {
  /** Free checks measured on the file (not AI). */
  fileChecks: FileCheck[];
  /** Which of the six outline parts the transcript covers. */
  outline: Record<PitchPartId, boolean>;
  endsWithAsk: boolean;
  compliance: ComplianceFlag[];
  recommendation: SpotlightRecommendation;
  /** One or two sentences for staff, from the AI. */
  summary: string;
  /** What the founder should change, when a change is recommended. */
  changeRequest: string | null;
  model: "ai" | "rules";
};

const SYSTEM = `You review 3 minute founder pitch videos for iCFO Capital investor events, using the transcript only.
iCFO standard:
1. The pitch covers six parts: hook and problem, solution, traction, market and model, team, the ask.
2. It ends with the ask: amount raising, use of funds, how to reach the founder.
3. Compliance: iCFO does not solicit securities and is not an investment adviser. Flag any statement that promises or guarantees returns, describes an offer or sale of securities to viewers, names a minimum investment, or tells viewers to invest. Quote the exact words.
Judge only what the transcript says. Never invent facts, numbers or quotes.
Reply with JSON only, no prose, in this shape:
{"outline":{"hook":bool,"solution":bool,"traction":bool,"market":bool,"team":bool,"ask":bool},"endsWithAsk":bool,"compliance":[{"quote":string,"why":string}],"recommendation":"approve"|"request_change"|"decline","summary":string,"changeRequest":string|null}
Recommend "decline" only for content unsuitable for an investor event. Recommend "request_change" for any compliance flag or two or more missing parts. Write without dashes as punctuation.`;

function emptyOutline(): Record<PitchPartId, boolean> {
  return Object.fromEntries(PITCH_OUTLINE.map((p) => [p.id, false])) as Record<PitchPartId, boolean>;
}

/** Parse the model's JSON defensively; anything malformed falls back to "needs a person". */
export function parseReviewJson(text: string): Omit<SpotlightReview, "fileChecks" | "model"> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const outline = emptyOutline();
  const o = (r.outline ?? {}) as Record<string, unknown>;
  for (const p of PITCH_OUTLINE) outline[p.id] = o[p.id] === true;
  const compliance = Array.isArray(r.compliance)
    ? (r.compliance as unknown[])
        .map((c) => (c && typeof c === "object" ? (c as Record<string, unknown>) : null))
        .filter((c): c is Record<string, unknown> => c !== null && typeof c.quote === "string")
        .slice(0, 10)
        .map((c) => ({ quote: String(c.quote).slice(0, 300), why: String(c.why ?? "").slice(0, 300) }))
    : [];
  const rec = r.recommendation;
  const recommendation: SpotlightRecommendation =
    rec === "approve" || rec === "decline" || rec === "request_change" ? rec : "request_change";
  return {
    outline,
    endsWithAsk: r.endsWithAsk === true,
    compliance,
    recommendation,
    summary: typeof r.summary === "string" ? r.summary.slice(0, 600) : "",
    changeRequest: typeof r.changeRequest === "string" && r.changeRequest.trim() ? r.changeRequest.slice(0, 600) : null,
  };
}

/** A file that fails a free check can never be recommended for approval. */
export function applyFileGate(review: SpotlightReview): SpotlightReview {
  const failed = review.fileChecks.filter((c) => !c.ok);
  if (failed.length === 0 || review.recommendation !== "approve") return review;
  return {
    ...review,
    recommendation: "request_change",
    changeRequest:
      review.changeRequest ??
      `Please fix the video: ${failed.map((c) => c.label.toLowerCase()).join(", ")}.`,
  };
}

export async function runSpotlightReview(input: {
  transcript: string;
  type: string;
  bytes: number;
  seconds: number | null;
  width: number | null;
  height: number | null;
  companyName: string | null;
  topic: string;
}): Promise<SpotlightReview> {
  const fileChecks = checkSpotlightFile({
    type: input.type,
    bytes: input.bytes,
    seconds: input.seconds,
    width: input.width,
    height: input.height,
  });
  const prompt = `Company: ${input.companyName ?? "unknown"}\nTitle: ${input.topic}\nTranscript:\n"""\n${input.transcript.slice(0, 20000)}\n"""`;
  const text = await claudeComplete([{ role: "user", content: prompt }], {
    system: SYSTEM,
    maxTokens: 900,
    temperature: 0,
    locale: "en",
    usage: { category: "internal", feature: "spotlight_review" },
  });
  const parsed = parseReviewJson(text);
  const review: SpotlightReview = parsed
    ? { ...parsed, fileChecks, model: "ai" }
    : {
        fileChecks,
        outline: emptyOutline(),
        endsWithAsk: false,
        compliance: [],
        recommendation: "request_change",
        summary: "The AI reply could not be read. Watch the video and decide.",
        changeRequest: null,
        model: "rules",
      };
  return applyFileGate(review);
}

const INTRO_SYSTEM = `You write the short introduction read before a founder's 3 minute pitch at an iCFO Capital investor event.
Two sentences, at most 45 words. Name the company and founder, the sector and stage, and what the company does, using only the facts given.
No claims about performance, returns or investment merit. No dashes as punctuation. Plain text only.`;

export async function draftSpotlightIntro(facts: {
  founderName: string | null;
  companyName: string | null;
  sector: string | null;
  stage: string | null;
  summary: string | null;
  topic: string;
}): Promise<string> {
  const lines = [
    `Founder: ${facts.founderName ?? "unknown"}`,
    `Company: ${facts.companyName ?? "unknown"}`,
    `Sector: ${facts.sector ?? "unknown"}`,
    `Stage: ${facts.stage ?? "unknown"}`,
    `One line summary: ${facts.summary ?? "none"}`,
    `Pitch title: ${facts.topic}`,
  ].join("\n");
  const text = await claudeComplete([{ role: "user", content: lines }], {
    system: INTRO_SYSTEM,
    maxTokens: 160,
    temperature: 0.3,
    locale: "en",
    usage: { category: "internal", feature: "spotlight_intro" },
  });
  return text.replace(/\s+/g, " ").trim().slice(0, 400);
}
