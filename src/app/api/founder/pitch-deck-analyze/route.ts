import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isClaudeConfigured, CLAUDE_SONNET } from "@/lib/claude";

export type PitchDeckSection = {
  name: string;
  score: number;        // 0-100
  verdict: "strong" | "good" | "needs_work" | "missing";
  feedback: string;
  tip: string;
};

export type PitchDeckAnalysis = {
  overallScore: number;
  overallVerdict: string;
  sections: PitchDeckSection[];
  topStrengths: string[];
  topGaps: string[];
  investorReaction: string;
  source: "ai" | "fallback";
};

const SECTIONS = [
  "Problem",
  "Solution",
  "Market size",
  "Business model",
  "Traction",
  "Team",
  "Financials",
  "The ask",
];

function fallbackAnalysis(): PitchDeckAnalysis {
  return {
    overallScore: 0,
    overallVerdict: "Analysis unavailable — AI is not configured.",
    sections: SECTIONS.map((name) => ({
      name,
      score: 0,
      verdict: "missing",
      feedback: "Unable to analyze without AI configuration.",
      tip: "Configure the ANTHROPIC_API_KEY to enable AI analysis.",
    })),
    topStrengths: [],
    topGaps: ["AI analysis not available"],
    investorReaction: "Unable to simulate investor reaction.",
    source: "fallback",
  };
}

function parseAnalysis(raw: string): PitchDeckAnalysis | null {
  // Strip markdown code fences
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned) as PitchDeckAnalysis;
  } catch {
    return null;
  }
}

export async function POST() {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const supabase = await createServerSupabaseClient();
  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) {
    return NextResponse.json({ error: "No company linked." }, { status: 400 });
  }

  // Find the pitch deck document
  const { data: doc } = await supabase
    .from("documents")
    .select("id, file_path, file_name, mime_type")
    .eq("company_id", company.id)
    .eq("document_type", "PITCH_DECK")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!doc?.file_path) {
    return NextResponse.json(
      { error: "No pitch deck found. Please upload your pitch deck first." },
      { status: 404 },
    );
  }

  if (!isClaudeConfigured()) {
    return NextResponse.json({ analysis: fallbackAnalysis() });
  }

  // Download file from Supabase Storage
  const admin = createServiceRoleClient();
  const { data: fileData, error: dlError } = await admin
    .storage
    .from("company-documents")
    .download(doc.file_path);

  if (dlError || !fileData) {
    return NextResponse.json(
      { error: "Unable to retrieve pitch deck file." },
      { status: 500 },
    );
  }

  // Convert to base64
  const arrayBuffer = await fileData.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mediaType = (doc.mime_type === "application/pdf") ? "application/pdf" : "application/pdf";

  const systemPrompt = `You are a world-class venture capital analyst who has reviewed thousands of pitch decks.
Your job is to analyze the provided pitch deck and return structured JSON feedback.
Be specific, direct, and investor-focused. No fluff — think like a partner at a top-tier VC.

Return ONLY valid JSON matching this exact schema:
{
  "overallScore": <number 0-100>,
  "overallVerdict": "<one sentence investor verdict>",
  "sections": [
    {
      "name": "<section name>",
      "score": <number 0-100>,
      "verdict": "<strong|good|needs_work|missing>",
      "feedback": "<2-3 specific sentences about what is/isn't working>",
      "tip": "<one concrete, actionable fix>"
    }
  ],
  "topStrengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "topGaps": ["<gap 1>", "<gap 2>", "<gap 3>"],
  "investorReaction": "<2-3 sentences simulating an honest investor's first impression>"
}

Sections to evaluate: ${SECTIONS.join(", ")}.
If a section is not present in the deck, set score to 0 and verdict to "missing".`;

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) throw new Error("No API key");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_SONNET,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: "text",
                text: `Analyze this pitch deck for ${company.company_name} (${company.industry ?? "unknown industry"}). Return the JSON analysis only.`,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API ${res.status}`);
    }

    const data = await res.json() as {
      content: Array<{ type: string; text: string }>;
    };
    const raw = data.content.find((b) => b.type === "text")?.text?.trim() ?? "";
    const analysis = parseAnalysis(raw);

    if (!analysis) {
      return NextResponse.json({ analysis: fallbackAnalysis() });
    }

    analysis.source = "ai";
    return NextResponse.json({ analysis });
  } catch {
    return NextResponse.json({ analysis: fallbackAnalysis() });
  }
}
