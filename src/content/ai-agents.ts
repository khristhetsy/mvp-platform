import { home } from "@/content/home";

/**
 * AI Agents page copy. Only agents that exist today are listed. Wording rules:
 * no dashes, no funding or introduction promises, and the platform disclaimer
 * is reused from the homepage so it stays one wording everywhere.
 */
export const aiAgents = {
  hero: {
    eyebrow: "AI Agents",
    title: "AI agents that help you get investable.",
    sub: "Your agents work from your own company information. They explain what to fix, then keep working with investors for you. You build them, you teach them, and you stay in charge.",
    primaryCta: { label: "Get started free", href: "/start" },
    secondaryCta: { label: "See plans", href: "/pricing" },
  },

  agents: {
    eyebrow: "Live today",
    title: "The agents you can use now.",
    items: [
      {
        tag: "Paid plans",
        h: "Investor Relations Agent",
        p: "Raising capital 24/7, nonstop. Your agent talks to investors, learns how they invest, answers from what you teach it, and books the call on your calendar.",
        cta: { label: "Compare plans", href: "/pricing" },
      },
      {
        tag: "Free",
        h: "AI Due Diligence Report",
        p: "A one time AI due diligence report and your Capital Readiness Rating, with clear steps to raise it. You can share the report with any investor. No credit card.",
        cta: { label: "Get my report", href: "/start" },
      },
    ],
  },

  how: {
    eyebrow: "How it works",
    title: "You stay in charge of what your agent says.",
    items: [
      { h: "You build it", p: "Set up your agent from your company profile. Its address comes from your company name." },
      { h: "You teach it", p: "Your agent answers from what you teach it, so it speaks about your company the way you would." },
      { h: "It works nonstop", p: "It talks to investors at any hour and books the call on your calendar." },
    ],
  },

  faq: {
    title: "Questions",
    items: [
      {
        q: "What is the Investor Relations Agent?",
        a: "It is your own agent for investors. It talks to them, learns how they invest, answers from what you teach it, and books the call on your calendar.",
      },
      {
        q: "What do I get for free?",
        a: "A one time AI due diligence report and your Capital Readiness Rating, with clear steps to raise it. No credit card.",
      },
      {
        q: "Does iCapOS promise funding?",
        a: home.hero.compliance,
      },
    ],
  },

  cta: {
    title: "Start with your free report.",
    sub: "See where you stand with investors, then decide which agents you want.",
    primary: { label: "Get started free", href: "/start" },
  },

  compliance: home.hero.compliance,
};
