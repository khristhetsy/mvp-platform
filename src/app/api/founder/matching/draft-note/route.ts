import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "@/lib/claude";

export const dynamic = "force-dynamic";

// POST /api/founder/matching/draft-note — draft a short, tailored introduction
// request from the founder to a specific investor (brokered via iCapOS). Uses the
// founder's company context + the investor's public criteria.
export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as
    | { name?: string; investorType?: string | null; sectors?: string[]; checkSize?: string | null }
    | null;

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "No company found." }, { status: 400 });

  const investorName = (body?.name ?? "").trim() || "there";
  const firstName = investorName.split(/\s+/)[0];

  if (!isClaudeConfigured()) {
    const note =
      `Hi ${firstName}, I'm building ${company.company_name}` +
      `${company.business_description ? ` — ${company.business_description.replace(/\s+/g, " ").slice(0, 160)}` : ""}. ` +
      `We're ${company.revenue_stage ? `at ${company.revenue_stage.replaceAll("_", " ")} stage` : "early"} and raising ` +
      `${company.funding_amount ? `$${Number(company.funding_amount).toLocaleString()}` : "a round"}. ` +
      `Given your focus${body?.sectors?.length ? ` on ${body.sectors.slice(0, 2).join(" and ")}` : ""}, we could be a strong fit — ` +
      `would you be open to a short introduction via iCapOS?`;
    return NextResponse.json({ note });
  }

  const raw = await claudeComplete(
    [
      {
        role: "user",
        content: JSON.stringify({
          company: company.company_name,
          industry: company.industry ?? null,
          stage: company.revenue_stage ?? null,
          fundingTarget: company.funding_amount ?? null,
          description: company.business_description ?? null,
          investorName,
          investorType: body?.investorType ?? null,
          investorSectors: body?.sectors ?? [],
          investorCheck: body?.checkSize ?? null,
        }),
      },
    ],
    {
      model: CLAUDE_SONNET,
      maxTokens: 350,
      system: [
        "You draft a short, warm introduction request from a startup founder to a specific investor, to be brokered through iCapOS.",
        "3–5 sentences, first person, specific to the company and why it fits THIS investor's focus (sector, stage, check size).",
        "Use the investor's first name; do not use bracketed placeholders. End by asking for a short introduction via iCapOS.",
        "Do not invent metrics not implied by the inputs. Return ONLY the note text — no preamble, quotes, or signature.",
      ].join(" "),
    },
  );

  return NextResponse.json({ note: raw.trim() });
}
