import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "./claude";
import { missingRequiredDocumentLabels } from "./data/founder-readiness";

function titleCaseCode(code: string): string {
  return code.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

type AnalysisInput = {
  companyName: string;
  documentSummaries: string[];
  /** Per-document summaries tagged with their document type, so each review
   *  section can be grounded in the right source (business plan, team bios…). */
  documentSummariesByType?: Array<{ type: string; file?: string; summary: string }>;
  uploadedDocumentTypes: string[];
  /** Document types the founder marked "not applicable" (e.g. no customer
   *  contracts for this business) — excluded from the missing list. */
  notApplicableDocumentTypes?: string[];
  /** Company profile context for a richer, venture-memo-style analysis. */
  industry?: string | null;
  revenueStage?: string | null;
  fundingAmount?: number | null;
  businessDescription?: string | null;
  useOfFunds?: string | null;
};

/** The review sections every report carries, in order. */
const REVIEW_SECTIONS = ["Business overview", "Financial review", "Market review", "Legal & compliance review", "Team review"] as const;

function stripJsonFences(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

type ParsedReport = { executiveSummary?: string; sections?: Array<{ title?: string; body?: string }>; riskFlags?: string[] };

/** Decode one JSON string literal body (without the surrounding quotes). */
function decodeJsonString(body: string): string | null {
  try {
    return JSON.parse(`"${body}"`) as string;
  } catch {
    return null;
  }
}

/**
 * Recover what is complete from a JSON reply that was cut off (output token limit).
 * Takes the executive summary, every fully closed section and every fully closed risk flag.
 * Returns null when nothing usable is found.
 */
function salvageTruncatedReport(raw: string): ParsedReport | null {
  const text = stripJsonFences(raw);
  const str = String.raw`"((?:[^"\\]|\\.)*)"`;
  const out: ParsedReport = {};

  const exec = new RegExp(String.raw`"executiveSummary"\s*:\s*` + str).exec(text);
  const execText = exec ? decodeJsonString(exec[1]) : null;
  if (execText) out.executiveSummary = execText;

  const sections: Array<{ title: string; body: string }> = [];
  const sectionRe = new RegExp(String.raw`\{\s*"title"\s*:\s*` + str + String.raw`\s*,\s*"body"\s*:\s*` + str + String.raw`\s*\}`, "g");
  for (const m of text.matchAll(sectionRe)) {
    const title = decodeJsonString(m[1]);
    const body = decodeJsonString(m[2]);
    if (title && body) sections.push({ title, body });
  }
  if (sections.length > 0) out.sections = sections;

  const flagsStart = text.search(/"riskFlags"\s*:\s*\[/);
  if (flagsStart >= 0) {
    const flags: string[] = [];
    const tail = text.slice(text.indexOf("[", flagsStart) + 1);
    for (const m of tail.matchAll(new RegExp(str + String.raw`\s*(?:,|\])`, "g"))) {
      const f = decodeJsonString(m[1]);
      if (f) flags.push(f);
    }
    if (flags.length > 0) out.riskFlags = flags;
  }

  return out.executiveSummary || out.sections || out.riskFlags ? out : null;
}

export type GeneratedDiligenceReport = {
  executiveSummary: string;
  sections: Array<{ title: string; body: string }>;
  riskFlags: string[];
  missingDocuments: string[];
  recommendedNextSteps: string[];
  readinessScore: number | null;
  generatedBy: "unconfigured" | "claude";
  isDemo: boolean;
};

export async function generateDiligenceReport(input: AnalysisInput): Promise<GeneratedDiligenceReport> {
  // Normalize DB codes → required labels (with aliases) so uploaded documents are
  // actually credited instead of everything reading as missing. Types the founder
  // marked "not applicable" are excluded from the missing list too.
  const missingDocuments = missingRequiredDocumentLabels(input.uploadedDocumentTypes, undefined, input.notApplicableDocumentTypes ?? []);
  const uploadedLabels = [...new Set(input.uploadedDocumentTypes.map(titleCaseCode))];
  const notApplicableLabels = [...new Set((input.notApplicableDocumentTypes ?? []).map(titleCaseCode))];

  const documentNextSteps =
    missingDocuments.length > 0
      ? [`Upload missing documents: ${missingDocuments.join(", ")}`]
      : ["Upload required diligence documents for review."];

  if (!isClaudeConfigured()) {
    return {
      executiveSummary:
        "AI diligence generation is not configured. Add ANTHROPIC_API_KEY to your environment variables or request staff-assisted review.",
      sections: REVIEW_SECTIONS.map((title) => ({ title, body: "Not provided." })),
      riskFlags: [],
      missingDocuments,
      recommendedNextSteps: documentNextSteps,
      readinessScore: null,
      generatedBy: "unconfigured",
      isDemo: true,
    };
  }

  const raw = await claudeComplete(
    [
      {
        role: "user",
        content: JSON.stringify({
          companyName: input.companyName,
          industry: input.industry ?? null,
          stage: input.revenueStage ?? null,
          fundingTarget: input.fundingAmount ?? null,
          businessDescription: input.businessDescription ?? null,
          useOfFunds: input.useOfFunds ?? null,
          uploadedDocuments: uploadedLabels,
          notApplicableDocuments: notApplicableLabels,
          missingDocuments,
          documentSummaries: input.documentSummaries,
          documentsByType: input.documentSummariesByType ?? [],
          naNote:
            notApplicableLabels.length > 0
              ? "Documents in notApplicableDocuments were marked not applicable by the founder (this business genuinely has none — e.g. a SaaS or biotech with no customer contracts). Do NOT list them as missing or frame them as gaps or risks."
              : undefined,
          summaryNote:
            input.documentSummaries.length === 0 && uploadedLabels.length > 0
              ? "Documents in uploadedDocuments ARE on file but not yet content-analyzed. Base each section only on what you can support; where a section has no supporting content yet, return exactly 'Not provided.' — do NOT claim no documents exist."
              : undefined,
        }),
      },
    ],
    { usage: { category: "founder", feature: "diligence_report" },
      model: CLAUDE_SONNET,
      // 3000 cut the JSON off mid string on document-heavy companies, so it never parsed.
      maxTokens: 8000,
      system: [
        "You are an investment analyst producing a conservative, detailed venture diligence memo for a startup.",
        "Return ONLY a valid JSON object (no prose, no markdown fences) with these keys:",
        '{ "executiveSummary": string, "sections": [{ "title": string, "body": string }], "riskFlags": string[] }',
        "The sections array MUST contain exactly these titles, in this order, using these exact strings:",
        '"Business overview", "Financial review", "Market review", "Legal & compliance review", "Team review".',
        "Each entry in documentsByType has a `type` (the category), a `file` (the individual document's name) and its `summary`. A category may contain SEVERAL files — read all of them and, when useful, name the file you are drawing from. Ground each section in its designated source category:",
        '"Business overview" and "Market review" come from the "Business Plan" document.',
        '"Financial review" comes from the "Financial Statements" document. Every company needs financial reporting regardless of revenue stage; if no "Financial Statements" document is present, set "Financial review" to exactly "Not provided." and add a risk flag noting financial statements are required.',
        '"Team review" comes from the "Team Bios" document.',
        '"Legal & compliance review" comes from the "Legal Documents" and "Corporate Documents".',
        "Write each section body as 2–5 substantive sentences grounded ONLY in that section's designated source document (plus business context).",
        "If a section's designated source document is absent or has no supporting content, set its body to exactly 'Not provided.' — do NOT fill it from other documents.",
        "executiveSummary: 2–4 sentences framing the company and the current state of diligence.",
        "riskFlags: concrete, specific diligence risks synthesized across ALL provided documents (each one sentence); use an empty array if none are supportable.",
        "Do NOT provide investment advice, recommend investing, or guarantee funding. Do NOT invent numbers, documents, or facts not present in the inputs.",
      ].join(" "),
    },
  );

  let parsed: ParsedReport | null = null;
  try {
    parsed = JSON.parse(stripJsonFences(raw));
  } catch {
    // Usually a reply cut off at the token limit: keep whatever is complete.
    parsed = salvageTruncatedReport(raw);
  }

  const bodyByTitle = new Map<string, string>();
  for (const s of parsed?.sections ?? []) {
    if (s?.title) bodyByTitle.set(s.title.trim().toLowerCase(), (s.body ?? "").trim());
  }
  const sections = REVIEW_SECTIONS.map((title) => {
    const body = bodyByTitle.get(title.toLowerCase());
    return { title, body: body && body.length > 0 ? body : "Not provided." };
  });

  const riskFlags = Array.isArray(parsed?.riskFlags)
    ? parsed!.riskFlags.filter((r): r is string => typeof r === "string" && r.trim().length > 0)
    : [];

  const executiveSummary =
    (parsed?.executiveSummary && parsed.executiveSummary.trim()) ||
    // Fallback: the reply was prose, keep it. Never store raw JSON as the summary.
    (/^\s*(```|\{)/.test(raw)
      ? "The AI analysis could not be read. Regenerate the report to try again."
      : raw.trim());

  return {
    executiveSummary,
    sections,
    riskFlags,
    missingDocuments,
    recommendedNextSteps: documentNextSteps,
    readinessScore: null,
    generatedBy: "claude",
    isDemo: false,
  };
}
