// Server-side assessment lead capture (§5.4). Scores answers authoritatively,
// upserts the lead (dedupe on lowercased email), best-effort upserts a founder
// CRM contact (no duplicate), and emits the band_assigned funnel event. No auth,
// no account creation, no product access is granted here.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { scoreAssessment, bandFor, BAND_HEADLINES, BAND_ROUTING, type AssessmentAnswers, type ScoreBand } from "@/lib/assessment/rubric";
import { recordFunnelEvent } from "@/lib/analytics/funnel";

export type CaptureLeadInput = {
  email: string;
  fullName?: string | null;
  companyName?: string | null;
  answers: AssessmentAnswers;
  utm?: Record<string, unknown> | null;
  sessionId: string;
};

export type CaptureLeadResult = {
  leadPrescore: number;
  band: ScoreBand;
  headline: string;
  routing: (typeof BAND_ROUTING)[ScoreBand];
};

/** Best-effort founder CRM upsert. Never throws into the caller. */
async function upsertCrmContact(
  db: ReturnType<typeof serviceRoleClientUntyped>,
  input: CaptureLeadInput,
  leadPrescore: number,
  band: ScoreBand,
): Promise<string | null> {
  try {
    const externalId = input.email.trim().toLowerCase();
    const { data } = await db
      .from("crm_contacts")
      .upsert(
        {
          source: "assessment",
          external_id: externalId,
          module: "founder",
          side: "founder",
          email: input.email.trim(),
          name: input.fullName?.trim() || null,
          company: input.companyName?.trim() || null,
          lead_prescore: leadPrescore,
          segment: band,
          lead_status: "new",
        },
        { onConflict: "source,external_id" },
      )
      .select("id")
      .maybeSingle();
    return (data as { id?: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

export async function captureAssessmentLead(input: CaptureLeadInput): Promise<CaptureLeadResult> {
  const { leadPrescore, band } = scoreAssessment(input.answers);
  const db = serviceRoleClientUntyped();

  const contactId = await upsertCrmContact(db, input, leadPrescore, band);

  try {
    await db.from("assessment_leads").upsert(
      {
        email: input.email.trim(),
        full_name: input.fullName?.trim() || null,
        company_name: input.companyName?.trim() || null,
        stage: typeof input.answers.stage === "string" ? input.answers.stage : null,
        capital_structure: typeof input.answers.capital_structure === "string" ? input.answers.capital_structure : null,
        lead_prescore: leadPrescore,
        score_band: band,
        answers: input.answers,
        utm: input.utm ?? null,
        converted_contact_id: contactId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );
  } catch {
    /* lead-store failure is non-fatal to the founder's result */
  }

  await recordFunnelEvent({
    sessionId: input.sessionId,
    eventName: "band_assigned",
    properties: { band, lead_prescore: leadPrescore },
  });

  return {
    leadPrescore,
    band,
    headline: BAND_HEADLINES[band] ?? BAND_HEADLINES[bandFor(leadPrescore)],
    routing: BAND_ROUTING[band],
  };
}
