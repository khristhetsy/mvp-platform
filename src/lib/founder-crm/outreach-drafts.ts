import type { FounderInvestorContactRecord } from "@/lib/founder-crm/types";
import type { Company } from "@/lib/supabase/types";
import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "@/lib/claude";

export type OutreachDraftKind = "intro" | "follow_up" | "meeting_request" | "investor_update";

type OutreachDraftInput = {
  kind: OutreachDraftKind;
  company: Company;
  contact: Pick<FounderInvestorContactRecord, "investor_name" | "firm_name" | "preferred_sectors" | "notes">;
  readinessScore?: number | null;
  founderName?: string | null;
  tone?: string | null;
};

function stripFences(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

/**
 * AI-written outreach draft — Claude writes bespoke copy for this investor in the
 * requested tone. Falls back to the deterministic template (generateOutreachDraft)
 * when Claude isn't configured or the response can't be parsed, so callers always
 * get a usable draft.
 */
export async function generateOutreachDraftAI(input: OutreachDraftInput): Promise<{ subject: string; body: string }> {
  const template = generateOutreachDraft(input);
  if (!isClaudeConfigured()) return template;

  const c = input.company as Company & { business_description?: string | null; use_of_funds?: string | null };
  const tone = (input.tone ?? "").trim() || "Warm";
  const kindLabel: Record<OutreachDraftKind, string> = {
    intro: "a first cold-outreach introduction",
    follow_up: "a short follow-up to a prior message",
    meeting_request: "a request to schedule a short call",
    investor_update: "a brief progress update",
  };

  const system = [
    "You are a startup founder writing a short outreach email to an investor.",
    `This email is ${kindLabel[input.kind]}. Write it in a ${tone} tone.`,
    "Keep it under ~130 words, specific to this investor and company, and free of clichés, hype, or filler.",
    "Do NOT invent facts, metrics, traction, or names not given in the input. Never promise returns or guarantee funding.",
    'Return ONLY valid JSON (no markdown): { "subject": string, "body": string }. The body may use \\n for line breaks and should end with a sign-off using the founder\'s name.',
  ].join(" ");

  const context = {
    tone,
    founderName: input.founderName ?? "the founder",
    company: {
      name: c.company_name,
      industry: c.industry ?? null,
      description: c.business_description ?? null,
      raiseAmount: c.funding_amount ?? null,
      useOfFunds: c.use_of_funds ?? null,
      capitalReadinessRating: input.readinessScore ?? null,
    },
    investor: {
      name: input.contact.investor_name,
      firm: input.contact.firm_name ?? null,
      focusSectors: input.contact.preferred_sectors ?? null,
    },
    founderNotesOnInvestor: input.contact.notes ?? null,
  };

  try {
    const raw = await claudeComplete(
      [{ role: "user", content: JSON.stringify(context) }],
      { model: CLAUDE_SONNET, maxTokens: 500, system },
    );
    const parsed = JSON.parse(stripFences(raw)) as { subject?: string; body?: string };
    if (parsed?.subject?.trim() && parsed?.body?.trim()) {
      return { subject: parsed.subject.trim(), body: parsed.body.trim() };
    }
  } catch {
    // fall through to the template
  }
  return template;
}

export function generateOutreachDraft(input: {
  kind: OutreachDraftKind;
  company: Company;
  contact: Pick<FounderInvestorContactRecord, "investor_name" | "firm_name" | "preferred_sectors" | "notes">;
  readinessScore?: number | null;
  founderName?: string | null;
  /** Tone preset (Warm | Direct | Concise | Formal | Storytelling) or free text. */
  tone?: string | null;
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
    input.readinessScore != null ? `Capital Readiness Rating: ${input.readinessScore}/100.` : "";
  const sectorFit = input.contact.preferred_sectors
    ? `Your focus on ${input.contact.preferred_sectors} aligns with ${companyName}.`
    : `We believe ${companyName} may fit your investment focus.`;
  const founder = input.founderName ?? "Founder";
  const notes = input.contact.notes ? `Notes: ${input.contact.notes}\n\n` : "";

  // Which tone preset drives the intro copy (free text falls back to Warm).
  const t = (input.tone ?? "").trim().toLowerCase();
  const toneKey = ["warm", "direct", "concise", "formal", "storytelling"].find((k) => t.includes(k)) ?? "warm";

  switch (input.kind) {
    case "intro": {
      const INTRO: Record<string, { subject: string; body: string }> = {
        warm: {
          subject: `A quick hello about ${companyName}`,
          body: `Hi ${investorName}${firm},

I'm ${founder} — I founded ${companyName}, working in ${industry}. I've been following investors like you and thought there might be a real fit.

${sectorFit} We're raising ${raise}, and I'd love to share what we're building over a short call.

${notes}${readiness}

Would you be open to a quick intro?

Warmly,
${founder}`,
        },
        direct: {
          subject: `${companyName} — ${raise} round, quick intro?`,
          body: `Hi ${investorName},

${founder} here, founder of ${companyName} (${industry}). We're raising ${raise}. ${sectorFit}

${readiness}

Worth a 15-minute call? I can send the deck ahead.

${founder}`,
        },
        concise: {
          subject: `${companyName}`,
          body: `Hi ${investorName},

${companyName} — ${industry}, raising ${raise}. ${sectorFit} ${readiness}

Open to a quick intro?

${founder}`,
        },
        formal: {
          subject: `Introduction: ${companyName}`,
          body: `Dear ${investorName}${firm},

My name is ${founder}, founder of ${companyName}, a company operating in ${industry}. We are currently raising ${raise} and are selectively engaging investors whose mandate aligns with our profile.

${sectorFit}
${readiness}

${notes}I would welcome the opportunity to share our materials and arrange a brief introductory call at your convenience.

Kind regards,
${founder}`,
        },
        storytelling: {
          subject: `Why we built ${companyName}`,
          body: `Hi ${investorName},

A while back we kept running into the same problem in ${industry} — so we built ${companyName} to solve it. It's grown into something I think you'd find interesting.

${sectorFit} We're now raising ${raise} to take the next step.

${notes}${readiness}

I'd love to tell you the rest over a short call — open to a quick intro?

Best,
${founder}`,
        },
      };
      return INTRO[toneKey] ?? INTRO.warm;
    }
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
