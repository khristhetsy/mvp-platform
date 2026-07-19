import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "@/lib/claude";

const schema = z.object({
  investor: z.object({
    name: z.string().min(1).max(200),
    firmName: z.string().nullable().optional(),
    investorType: z.string().nullable().optional(),
    preferredSectors: z.string().nullable().optional(),
    preferredStages: z.string().nullable().optional(),
    checkSizeMin: z.number().nullable().optional(),
    checkSizeMax: z.number().nullable().optional(),
    geography: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    matchScore: z.number().nullable().optional(),
  }),
  companySnapshot: z.object({
    companyName: z.string(),
    industry: z.string().nullable().optional(),
    businessDescription: z.string().nullable().optional(),
    revenueStage: z.string().nullable().optional(),
    fundingAmount: z.number().nullable().optional(),
    geography: z.string().nullable().optional(),
    founderGoals: z.string().nullable().optional(),
  }),
});

const SYSTEM_PROMPT = `You are a seasoned venture capital advisor and fundraising coach helping a startup founder craft the perfect outreach to a specific investor.

Important context: this investor is one of the founder's OWN contacts — a warm lead they added or an investor they are already connected to. This is manual, founder-sent outreach. Outreach to unfamiliar platform investors is handled automatically by the iCapOS team and is NOT your concern. Never advise cold-emailing investors the founder has no relationship with; assume an existing or warm connection and coach accordingly.

Your job is to analyse the investor's profile and the founder's company, then produce a highly personalised outreach strategy.

Return a JSON object with exactly these fields:
{
  "framing": "2-3 sentences: how to frame this outreach for THIS investor specifically — what angle to lead with and why",
  "subjectLine": "A compelling, personalised subject line (under 60 chars)",
  "talkingPoints": ["point 1", "point 2", "point 3"],
  "watchOut": "One specific risk or concern this investor might have — and how to pre-empt it",
  "emailDraft": "Full personalised email draft (no placeholders if avoidable — use the actual company data). Where real data is missing, use [brackets].",
  "whyFraming": "1-2 sentences explaining the strategic rationale behind your framing recommendation"
}

Rules:
- Be specific to THIS investor's focus areas, stage, and geography
- Talking points should be 1 sentence each, actionable and concrete
- The email should be 150-200 words, direct, founder-voice
- No generic phrases like "I hope this finds you well"
- Return ONLY the JSON object, no markdown, no explanation`;

export type OutreachCoachResult = {
  framing: string;
  subjectLine: string;
  talkingPoints: string[];
  watchOut: string;
  emailDraft: string;
  whyFraming: string;
  source: "claude" | "fallback";
};

function fallbackResult(investor: z.infer<typeof schema>["investor"], company: z.infer<typeof schema>["companySnapshot"]): OutreachCoachResult {
  const name = investor.name;
  const firm = investor.firmName ? ` at ${investor.firmName}` : "";
  const sector = investor.preferredSectors ?? company.industry ?? "[your sector]";

  return {
    framing: `Lead with your strongest alignment signal — ${investor.preferredSectors ? `their focus on ${investor.preferredSectors}` : "your sector fit"}. Keep the intro tight: who you are, what you do, why them specifically.`,
    subjectLine: `${company.companyName} — ${company.industry ?? "[industry]"} founder intro`,
    talkingPoints: [
      `Why ${name}${firm} is the right partner — reference their ${sector} focus specifically`,
      `Your single strongest traction proof point (ARR, customers, growth rate)`,
      `What you need beyond capital — strategic value they can uniquely provide`,
    ],
    watchOut: `${investor.investorType?.toLowerCase().includes("vc") ? "VCs" : "Investors"} will ask about your defensibility — prepare a crisp answer on your moat before reaching out.`,
    emailDraft: `Hi ${name},

I'm the founder of ${company.companyName}${company.industry ? `, a ${company.industry} company` : ""}${company.geography ? ` based in ${company.geography}` : ""}. ${company.businessDescription ? company.businessDescription.split(".")[0] + "." : "[Describe what you do in one sentence.]"}

${investor.preferredSectors ? `I'm reaching out because your focus on ${investor.preferredSectors} aligns directly with what we're building.` : "I believe there's strong alignment between your investment thesis and our company."}

[Add your strongest traction proof point here — ARR, customers, growth rate, or a key milestone.]

We're raising ${company.fundingAmount ? `$${company.fundingAmount.toLocaleString()}` : "[round size]"} and speaking with a select group of investors. Would you be open to a 20-minute intro call?

Best,
[Your name]`,
    whyFraming: `AI coaching is not configured (add ANTHROPIC_API_KEY). This is a structured template based on the investor's known profile.`,
    source: "fallback",
  };
}

export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 400 });
  }

  const { investor, companySnapshot: company } = parsed.data;

  if (!isClaudeConfigured()) {
    return NextResponse.json(fallbackResult(investor, company));
  }

  const checkSize = investor.checkSizeMin || investor.checkSizeMax
    ? `$${(investor.checkSizeMin ?? 0).toLocaleString()}–$${(investor.checkSizeMax ?? 0).toLocaleString()}`
    : null;

  const investorContext = [
    `Investor name: ${investor.name}`,
    investor.firmName ? `Firm: ${investor.firmName}` : null,
    investor.investorType ? `Type: ${investor.investorType}` : null,
    investor.preferredSectors ? `Focus sectors: ${investor.preferredSectors}` : null,
    investor.preferredStages ? `Preferred stages: ${investor.preferredStages}` : null,
    checkSize ? `Typical check size: ${checkSize}` : null,
    investor.geography ? `Geography: ${investor.geography}` : null,
    investor.matchScore != null ? `Platform match score: ${investor.matchScore}%` : null,
    investor.notes ? `Founder notes: ${investor.notes}` : null,
  ].filter(Boolean).join("\n");

  const companyContext = [
    `Company: ${company.companyName}`,
    company.industry ? `Industry: ${company.industry}` : null,
    company.businessDescription ? `Business: ${company.businessDescription}` : null,
    company.revenueStage ? `Stage: ${company.revenueStage}` : null,
    company.fundingAmount ? `Raising: $${company.fundingAmount.toLocaleString()}` : null,
    company.geography ? `Location: ${company.geography}` : null,
    company.founderGoals ? `Founder goals: ${company.founderGoals}` : null,
  ].filter(Boolean).join("\n");

  const userMessage = `Investor profile:\n${investorContext}\n\nCompany:\n${companyContext}\n\nGenerate a personalised outreach strategy as JSON.`;

  try {
    const raw = await claudeComplete(
      [{ role: "user", content: userMessage }],
      { model: CLAUDE_SONNET, maxTokens: 900, system: SYSTEM_PROMPT },
    );

    // Strip any markdown code fences
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const result = JSON.parse(cleaned) as OutreachCoachResult;
    return NextResponse.json({ ...result, source: "claude" });
  } catch (err) {
    // If JSON parse fails, fall back to structured template
    console.error("Outreach coach AI error:", err);
    return NextResponse.json(fallbackResult(investor, company));
  }
}
