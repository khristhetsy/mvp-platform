// The 12 standard investor pitch-deck slides. `help` shows under each slide;
// `prompt` guides the AI draft; `fromSection` maps to a business-plan section for prefill.

export interface DeckSlideDef {
  id: string;
  title: string;
  group: string;
  help: string;
  prompt: string;
  /** business-plan section id to prefill body from, if any. */
  fromSection?: string;
}

export const DECK_SLIDES: DeckSlideDef[] = [
  { id: "title", title: "Title", group: "Open", help: "Company, tagline, and the one-line what-you-do.", prompt: "Write a punchy one-line tagline and a single sentence describing what the company does." },
  { id: "problem", title: "Problem", group: "Open", help: "The pain you remove — concrete, urgent, expensive.", prompt: "Write a slide headline and 3 short bullets describing the customer's problem.", fromSection: "problem" },
  { id: "solution", title: "Solution", group: "Open", help: "How you solve it, and why your way wins.", prompt: "Write a headline and 3 bullets describing the solution and its key differentiator.", fromSection: "solution" },
  { id: "product", title: "Product", group: "Open", help: "What it is and how it works — the demo in words.", prompt: "Write a headline and 3 bullets describing the product and how a customer uses it.", fromSection: "solution" },
  { id: "market", title: "Market size", group: "Market", help: "TAM / SAM / SOM and why now.", prompt: "Write a headline and 3 bullets covering TAM, SAM, SOM with a one-line rationale each. Leave [bracketed] prompts for missing figures.", fromSection: "market" },
  { id: "business_model", title: "Business model", group: "Market", help: "How you make money.", prompt: "Write a headline and 3 bullets on the revenue model, pricing, and margins.", fromSection: "business_model" },
  { id: "traction", title: "Traction", group: "Proof", help: "Proof points and momentum.", prompt: "Write a headline and 3 bullets summarizing traction and the next milestones.", fromSection: "traction" },
  { id: "competition", title: "Competition", group: "Proof", help: "How you compare — and your moat.", prompt: "Write a headline and 3 bullets on the competitive landscape and your defensible advantage.", fromSection: "competition" },
  { id: "team", title: "Team", group: "Proof", help: "Why you're the team to win.", prompt: "Write a headline and 3 bullets on the founding team and why they're suited to this.", fromSection: "team" },
  { id: "financials", title: "Financials", group: "The ask", help: "The trajectory — revenue and key drivers.", prompt: "Write a headline and 3 bullets summarizing the financial trajectory. Never fabricate figures; leave [bracketed] prompts.", fromSection: "projections" },
  { id: "ask", title: "The ask", group: "The ask", help: "What you're raising and where it goes.", prompt: "Write a headline and 3 bullets on the raise amount and use of funds tied to milestones.", fromSection: "use_of_funds" },
  { id: "contact", title: "Contact", group: "The ask", help: "How to reach you.", prompt: "Write a closing line and a placeholder for name, email, and website." },
];

export const DECK_GROUPS = ["Open", "Market", "Proof", "The ask"];

export function getDeckSlideDef(id: string): DeckSlideDef | undefined {
  return DECK_SLIDES.find((s) => s.id === id);
}
