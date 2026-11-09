import { NextRequest, NextResponse } from "next/server";
import { gateAiRun } from "@/lib/ai-usage/gate";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { getJourneyOverview } from "@/lib/founder/stage-gate-status";
import { getSubscription } from "@/lib/subscriptions/get-subscription";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";
import { claudeComplete, isClaudeConfigured, CLAUDE_HAIKU, type ClaudeMessage } from "@/lib/claude";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { priceLabel, type PricingCatalog } from "@/lib/subscriptions/pricing-catalog";
import { loadPricing } from "@/lib/subscriptions/pricing-server";
import { getSupportSettings } from "@/lib/support/settings";
import { submitSupportRequest } from "@/lib/support/submit";
import { getInvestorProfileByProfileId } from "@/lib/investor/profile";
import { loadInvestorStageView } from "@/lib/investor-journey/load";
import { INVESTOR_STAGE_META } from "@/lib/investor-journey/stages";
import { logSupportEvent, type AiCost } from "@/lib/support/events";
import { premiumCheckoutReady } from "@/lib/billing/buy-links";

export const dynamic = "force-dynamic";

const schema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20),
});

/** The model's signal that a person should answer. Never shown to the founder. */
const HANDOFF_TAG = "[HANDOFF]";

// Grounds the assistant in what iCapOS actually is, so it doesn't invent
// features. Kept short and honest; account-specific facts come from context.
const productBrief = (catalog: PricingCatalog) => `iCapOS is a capital-readiness and investor-distribution platform for founders. A founder's raise moves through four stages, in order: Stage 1 Onboarding, Stage 2 Preparation, Stage 3 Marketing, Stage 4 Closing. The tools — Capital Readiness Rating (CRR), valuation, data room/documents, and e-learning — are included on every paid plan. What the paid plans add is distribution: your matched investors are revealed and your materials are sent to them. Plans are Basic (${priceLabel(catalog, "founder_basic")}/mo, up to 5 matched investors, Investor Conference Virtual Event access, DIY outreach), Professional (${priceLabel(catalog, "founder_professional")}/mo, up to 50, monthly live presentation slot, investor intro requests), ${premiumCheckoutReady() ? `Premium (${priceLabel(catalog, "founder_premium")}/mo, everything in Professional with the iCFO team running the investor outreach for the founder), ` : ""}and the SPV Program (done-for-you, 3-month minimum, pricing discussed on a call — never quote a figure). Investor accounts are free. There are no success fees, no carry, and no commission on an introduction. Investor interest shown on the platform is a non-binding indication of interest, not a commitment.

The Market Claim Grader IS the platform's market research tool. If a founder asks where to find "market research", "market analysis", "market sizing", "TAM/SAM/SOM", or anything similar, point them to the Market Claim Grader, located under Stage 2 — Preparation in the left menu (Market claim grader). It grades the market claims in their materials and shows where to tighten them.`;

// The investor side of the same assistant. Grounded only in what the investor
// workspace actually does, drawn from the four stage guides.
const investorProductBrief = `iCapOS is a capital-readiness and investor-distribution platform. Investors use it to find and back private market deals. An investor's journey moves through four stages, in order: Stage 1 Onboarding (set up your investor profile and get it approved), Stage 2 Verification (verify identity and accreditation, which unlocks deal flow), Stage 3 Deals access (matches, watchlist, interest pipeline, deal room, introduction requests, and committing to a deal through an SPV), and Stage 4 Manage deals (portfolio, SPVs and closings, recent activity). Each stage has a Stage guide in the left menu that explains the steps. Investor accounts are free. Investor interest shown on the platform is a non-binding indication of interest, not a commitment. iCapOS is not a broker-dealer, placement agent, or investment adviser.`;

function buildInvestorSystem(ctx: { name: string; stage: string | null }): string {
  return [
    "You are the iCapOS in-app support assistant, helping an investor use the platform.",
    "",
    "About the product:",
    investorProductBrief,
    "",
    "Who you're talking to:",
    `- Name: ${ctx.name}`,
    ctx.stage ? `- Current stage: ${ctx.stage}` : "",
    "",
    "How to help:",
    "- Be concise, warm, and plain-spoken. Prefer 2-5 sentences. Use the investor's stage to make answers specific.",
    "- Point them to the right place in the app by name (for example the Stage guide for their stage, Identity & accreditation, Matches, the Deal Room, SPVs & closings, Help & guides).",
    "- You can explain how features work, what unlocks a stage, and what to do next. You cannot see private data you weren't given here, and you cannot take actions on their account. Say so plainly when relevant.",
    "- Do NOT give legal, tax, securities, or investment advice, and never recommend a deal or say whether to invest. iCapOS is not a broker-dealer, placement agent, or investment adviser. For those questions, suggest they consult a qualified professional.",
    "- If you don't know, or the request needs a human, say so and tell them to use “Hand off to the iCapOS team” below the chat.",
    "",
    "Hand off instead of answering:",
    `- If the investor asks about a specific deal's terms or documents, their own verification or accreditation status or documents, their commitments or SPV paperwork, reports a bug or error, or asks anything specific to their account, do NOT answer. Reply with exactly ${HANDOFF_TAG} followed by a 3 to 6 word topic, and nothing else. Example: ${HANDOFF_TAG} Accreditation document review`,
    "- Only answer how-to questions about using iCapOS from the product facts above. If you'd have to guess, hand off.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSystem(ctx: {
  name: string;
  company: string | null;
  stage: string | null;
  plan: string | null;
  pricing: PricingCatalog;
}): string {
  return [
    "You are the iCapOS in-app support assistant, helping a founder use the platform to run their raise.",
    "",
    "About the product:",
    productBrief(ctx.pricing),
    "",
    "Who you're talking to:",
    `- Name: ${ctx.name}`,
    ctx.company ? `- Company: ${ctx.company}` : "",
    ctx.stage ? `- Current stage: ${ctx.stage}` : "",
    ctx.plan ? `- Plan: ${ctx.plan}` : "",
    "",
    "How to help:",
    "- Be concise, warm, and plain-spoken. Prefer 2-5 sentences. Use the founder's stage and plan to make answers specific.",
    "- Point them to the right place in the app by name (e.g. Stage 2 — Preparation, the Documents area, Settings → Billing & subscription, the How it works guides).",
    "- You can explain how features work, what unlocks a stage, what a plan includes, and what to do next. You cannot see private data you weren't given here, and you cannot take actions on their account — say so plainly when relevant.",
    "- Do NOT give legal, tax, securities, or investment advice. iCapOS is not a broker-dealer, placement agent, or investment adviser. For those questions, suggest they consult a qualified professional.",
    "- If you don't know, or the request needs a human (billing changes, something account-specific, or anything you can't resolve), say so and tell them to use “Hand off to the iCapOS team” below the chat.",
    "",
    "Hand off instead of answering:",
    `- If the founder asks about their own numbers, financial model, projections, valuation or raise terms, asks for a review of their documents, wants a billing or plan change or refund, reports a bug or error, or asks anything specific to their account, do NOT answer. Reply with exactly ${HANDOFF_TAG} followed by a 3 to 6 word topic, and nothing else. Example: ${HANDOFF_TAG} Financial model review`,
    "- Only answer how-to questions about using iCapOS from the product facts above. If you'd have to guess, hand off.",
  ]
    .filter(Boolean)
    .join("\n");
}

type Handoff = { requestId: string; ownerName: string | null; dueAt: string | null; topic: string };

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["founder", "investor"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Founders and investors only." }, { status: 403 });
  const isInvestor = profile.role === "investor";
  const who = isInvestor ? "Investor" : "Founder";

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid message payload." }, { status: 400 });

  const name = profile.full_name?.split(" ")[0] ?? profile.full_name ?? "there";
  const lastQuestion = [...parsed.data.messages].reverse().find((m) => m.role === "user")?.content ?? "";

  // Best-effort grounding context. Never let a context miss break the chat.
  let company: string | null = null;
  let companyId: string | null = null;
  let stage: string | null = null;
  let plan: string | null = null;
  const supabase = (await createServerSupabaseClient()) as unknown as SupabaseClient<Database>;
  try {
    if (isInvestor) {
      const investorProfile = await getInvestorProfileByProfileId(profile.id);
      const view = investorProfile ? await loadInvestorStageView(investorProfile) : null;
      if (view) {
        const meta = INVESTOR_STAGE_META[view.current.key];
        stage = `Stage ${meta.number} – ${meta.label}`;
      }
    } else {
    const [{ company: activeCompany }, journey, subscription] = await Promise.all([
      getActiveCompanyForUser(profile),
      getJourneyOverview(supabase, profile.id).catch(() => null),
      getSubscription(profile.id).catch(() => null),
    ]);
    company = activeCompany?.company_name ?? null;
    companyId = activeCompany?.id ?? null;
    if (journey?.currentSlug) {
      const cur = journey.stages.find((s) => s.slug === journey.currentSlug);
      stage = cur ? `Stage ${cur.stageNumber} — ${cur.name} (${cur.line})` : null;
    }
    plan = subscription ? PLAN_LABELS[subscription.plan_type] ?? null : null;
    }
  } catch {
    /* grounding is optional */
  }

  // Hand the conversation to a person: open a request, name the owner and the time.
  async function handOff(topic: string, aiCost: AiCost | null): Promise<Response> {
    if (!companyId && !isInvestor) {
      return NextResponse.json({
        reply: "This one needs a person. Use “Hand off to the iCapOS team” below and our team will pick it up.",
      });
    }
    const transcript = parsed.data!.messages
      .map((m) => `${m.role === "user" ? who : "Assistant"}: ${m.content}`)
      .join("\n\n");
    const result = await submitSupportRequest(supabase, {
      companyId,
      requesterRole: isInvestor ? "investor" : "founder",
      founderId: profile!.id,
      subject: (topic || lastQuestion).slice(0, 120) || "Question from the assistant",
      body: `Handed off by the assistant.\n\n${transcript}`,
      source: "question",
      contextItem: "Assistant",
      via: "assistant",
    });
    if ("error" in result) {
      return NextResponse.json({ reply: "I couldn't reach the team just now. Use “Hand off to the iCapOS team” below to try again." });
    }
    const handoff: Handoff = { requestId: result.id, ownerName: result.ownerName, dueAt: result.dueAt, topic };
    await logSupportEvent({
      requestId: result.id,
      founderId: profile!.id,
      actor: "ai",
      kind: "ai_handoff",
      summary: "AI handed off to a person",
      detail: aiCost ? `Reason: ${topic || "needs a person"}` : "Reason: the assistant is set to send every question to a person",
      ai: aiCost,
    });
    return NextResponse.json({
      reply: "This is something our team handles personally, so I've passed it to a person.",
      handoff,
    });
  }

  const settings = await getSupportSettings();
  // Support queue, Notifications, AI: "Answer founders directly" off sends every question to a person.
  if (!settings.ai.answerFounders) return handOff("", null);

  if (!isClaudeConfigured()) {
    return NextResponse.json({
      reply:
        "The assistant is offline right now. Use “Hand off to the iCapOS team” below and a person will help you — usually within one business day.",
    });
  }

  const system = isInvestor ? buildInvestorSystem({ name, stage }) : buildSystem({ name, company, stage, plan, pricing: await loadPricing() });
  const messages: ClaudeMessage[] = parsed.data.messages.map((m) => ({ role: m.role, content: m.content }));

  try {
    // Per-plan run cap (Admin, Feature Controls, AI usage limits).
    const aiRun = await gateAiRun(profile.id, "support_assistant");
    if (aiRun.blocked) return aiRun.blocked;
    let cost: AiCost | null = null;
    const reply = await aiRun.run(() => claudeComplete(messages, { usage: { category: isInvestor ? "investor" : "founder", feature: "support_assistant" },
      model: CLAUDE_HAIKU,
      system,
      maxTokens: 700,
      temperature: 0.3,
      onUsage: (u) => (cost = u),
    }));
    await aiRun.done();

    if (reply.trim().startsWith(HANDOFF_TAG)) {
      return handOff(reply.trim().slice(HANDOFF_TAG.length).trim().slice(0, 80), cost);
    }

    await logSupportEvent({
      requestId: null,
      founderId: profile.id,
      actor: "ai",
      kind: "ai_answer",
      summary: "AI answered a how-to question",
      detail: lastQuestion,
      ai: cost,
    });
    return NextResponse.json({
      reply:
        reply ||
        "I couldn't put together an answer just now. Try rephrasing, or use “Hand off to the iCapOS team” below.",
      answered: Boolean(reply),
    });
  } catch {
    return NextResponse.json(
      {
        reply:
          "Something went wrong reaching the assistant. Please try again, or use “Hand off to the iCapOS team” below.",
      },
      { status: 200 },
    );
  }
}
