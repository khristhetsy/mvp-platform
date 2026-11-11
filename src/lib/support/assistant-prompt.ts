/**
 * The in app support assistant's prompt, shared by the founder route and the
 * admin test chat so a test answers exactly as a founder would see it.
 *
 * The product knowledge is a template an admin can edit (Admin, Support, Train
 * assistant). The token {{PLANS}} is replaced at answer time with the live plan
 * list and prices from Admin Pricing, so prices are never typed into the text.
 */
import { premiumCheckoutReady } from "@/lib/billing/buy-links";
import { priceLabel, type PricingCatalog } from "@/lib/subscriptions/pricing-catalog";

/** The model's signal that a person should answer. Never shown to the founder. */
export const HANDOFF_TAG = "[HANDOFF]";

export const PLANS_TOKEN = "{{PLANS}}";

/** What the assistant knows when no admin text is saved. Same facts as before training existed. */
export const DEFAULT_BRIEF_TEMPLATE = `iCapOS is a capital-readiness and investor-distribution platform for founders. A founder's raise moves through four stages, in order: Stage 1 Onboarding, Stage 2 Preparation, Stage 3 Marketing, Stage 4 Closing. The tools — Capital Readiness Rating (CRR), valuation, data room/documents, and e-learning — are included on every paid plan. What the paid plans add is distribution: your matched investors are revealed and your materials are sent to them. ${PLANS_TOKEN} Investor accounts are free. There are no success fees, no carry, and no commission on an introduction. Investor interest shown on the platform is a non-binding indication of interest, not a commitment.

The Market Claim Grader IS the platform's market research tool. If a founder asks where to find "market research", "market analysis", "market sizing", "TAM/SAM/SOM", or anything similar, point them to the Market Claim Grader, located under Stage 2 — Preparation in the left menu (Market claim grader). It grades the market claims in their materials and shows where to tighten them.`;

/** The live plan sentence, built from Admin Pricing. */
export function plansSentence(catalog: PricingCatalog): string {
  return `Plans are Basic (${priceLabel(catalog, "founder_basic")}/mo, up to 5 matched investors, Investor Conference Virtual Event access, DIY outreach), Professional (${priceLabel(catalog, "founder_professional")}/mo, up to 50, monthly live presentation slot, investor intro requests), ${premiumCheckoutReady() ? `Premium (${priceLabel(catalog, "founder_premium")}/mo, everything in Professional with the iCFO team running the investor outreach for the founder), ` : ""}and the SPV Program (done-for-you, 3-month minimum, pricing discussed on a call — never quote a figure).`;
}

/**
 * Fill the template. A saved text that dropped the token still gets the live
 * plans, appended, so the assistant can never answer plan questions without them.
 */
export function renderBrief(template: string, catalog: PricingCatalog): string {
  const plans = plansSentence(catalog);
  const text = template.trim() ? template : DEFAULT_BRIEF_TEMPLATE;
  return text.includes(PLANS_TOKEN) ? text.split(PLANS_TOKEN).join(plans) : `${text.trim()}\n\n${plans}`;
}

export type AssistantTraining = {
  /** Admin edited product knowledge, or null for the default. */
  briefTemplate: string | null;
  taught: Array<{ id: string; question: string; answer: string }>;
  sources: string[];
};

export const EMPTY_TRAINING: AssistantTraining = { briefTemplate: null, taught: [], sources: [] };

const MAX_SOURCE_CHARS = 12000;

export function buildSystem(ctx: {
  name: string;
  company: string | null;
  stage: string | null;
  plan: string | null;
  pricing: PricingCatalog;
  training?: AssistantTraining;
}): string {
  const training = ctx.training ?? EMPTY_TRAINING;
  const hasTraining = training.taught.length > 0 || training.sources.length > 0;
  return [
    "You are the iCapOS in-app support assistant, helping a founder use the platform to run their raise.",
    "",
    "About the product:",
    renderBrief(training.briefTemplate ?? DEFAULT_BRIEF_TEMPLATE, ctx.pricing),
    training.taught.length
      ? `\nAPPROVED ANSWERS from the iCapOS team (use these words when the question comes up):\n${training.taught.map((t) => `Q: ${t.question}\nA: ${t.answer}`).join("\n\n")}`
      : "",
    training.sources.length ? `\nFROM THE iCapOS HELP DOCUMENTS:\n${training.sources.join("\n\n").slice(0, MAX_SOURCE_CHARS)}` : "",
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
    hasTraining
      ? "- Only answer how-to questions about using iCapOS from the product facts, approved answers and documents above. If you'd have to guess, hand off."
      : "- Only answer how-to questions about using iCapOS from the product facts above. If you'd have to guess, hand off.",
  ]
    .filter(Boolean)
    .join("\n");
}
