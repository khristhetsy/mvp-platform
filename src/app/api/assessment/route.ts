import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { captureAssessmentLead } from "@/lib/assessment/leads";
import { recordFunnelEvent } from "@/lib/analytics/funnel";

export const dynamic = "force-dynamic";

// Public, no-auth lead capture for the assessment (§5.4). Scores server-side,
// stores the lead, upserts a founder CRM contact, and returns band + headline.
const schema = z.object({
  email: z.string().email().max(200),
  fullName: z.string().max(160).nullish(),
  companyName: z.string().max(200).nullish(),
  answers: z.record(z.string(), z.string()).default({}),
  utm: z.record(z.string(), z.unknown()).nullish(),
  sessionId: z.string().min(1).max(120),
});

export async function POST(req: NextRequest): Promise<Response> {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email and answers are required." }, { status: 400 });
  }
  const { email, fullName, companyName, answers, utm, sessionId } = parsed.data;
  try {
    await recordFunnelEvent({ sessionId, eventName: "assessment_complete" });
    const result = await captureAssessmentLead({
      email,
      fullName: fullName ?? null,
      companyName: companyName ?? null,
      answers,
      utm: utm ?? null,
      sessionId,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not process the assessment." }, { status: 500 });
  }
}
