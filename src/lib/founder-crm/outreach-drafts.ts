import type { FounderInvestorContactRecord } from "@/lib/founder-crm/types";
import type { Company } from "@/lib/supabase/types";

export type OutreachDraftKind = "intro" | "follow_up" | "meeting_request" | "investor_update";

export function generateOutreachDraft(input: {
  kind: OutreachDraftKind;
  company: Company;
  contact: Pick<FounderInvestorContactRecord, "investor_name" | "firm_name" | "preferred_sectors" | "notes">;
  readinessScore?: number | null;
  founderName?: string | null;
}) {
  const companyName = input.company.company_name;
  const investorName = input.contact.investor_name;
  const firm = input.contact.firm_name ? ` at ${input.contact.firm_name}` : "";
  const industry = input.company.industry ?? "our sector";
  const raise =
    input.company.funding_amount != null
      ? `$${Number(input.company.funding_amount).toLocaleString("en-US")}`
      : "our current round";
  const readiness =
    input.readinessScore != null ? `Readiness score: ${input.readinessScore}/100.` : "";
  const sectorFit = input.contact.preferred_sectors
    ? `Your focus on ${input.contact.preferred_sectors} aligns with ${companyName}.`
    : `We believe ${companyName} may fit your investment focus.`;
  const founder = input.founderName ?? "Founder";

  switch (input.kind) {
    case "intro":
      return {
        subject: `Introduction — ${companyName}`,
        body: `Hi ${investorName}${firm},

I'm ${founder}, founder of ${companyName} (${industry}). We are raising ${raise} and would value a brief introduction to explore fit.

${sectorFit}
${readiness}

${input.contact.notes ? `Notes: ${input.contact.notes}\n\n` : ""}Happy to share our deck and schedule a short call at your convenience.

Best,
${founder}`,
      };
    case "follow_up":
      return {
        subject: `Following up — ${companyName}`,
        body: `Hi ${investorName},

Following up on ${companyName}. We remain focused on ${raise} and would appreciate any feedback on materials we shared.

${readiness}

Please let me know if a short update call would be helpful.

Best,
${founder}`,
      };
    case "meeting_request":
      return {
        subject: `Meeting request — ${companyName}`,
        body: `Hi ${investorName},

I'd like to schedule a 20–30 minute conversation about ${companyName} and how we are approaching ${raise}.

${sectorFit}

Please share a few times that work for you, or I can send availability.

Best,
${founder}`,
      };
    case "investor_update":
      return {
        subject: `Investor update — ${companyName}`,
        body: `Hi ${investorName},

Quick update on ${companyName}:

• Industry: ${industry}
• Raise: ${raise}
${readiness ? `• ${readiness}` : ""}

We are making disciplined progress on institutional readiness and would welcome your perspective.

Best,
${founder}`,
      };
  }
}
