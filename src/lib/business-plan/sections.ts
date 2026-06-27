// The 15-section business-plan structure. `help` is the plain-language line shown
// under each section; `prompt` guides the AI draft. `minStageDepth` lets us show a
// leaner set to earlier-stage founders later (all included for now).

export interface BusinessPlanSectionDef {
  id: string;
  title: string;
  group: string;
  help: string;
  /** Hint passed to the AI when drafting this section. */
  prompt: string;
  /** Sections flagged "core" form the lean set for early-stage founders. */
  core: boolean;
}

export const BUSINESS_PLAN_SECTIONS: BusinessPlanSectionDef[] = [
  // The opportunity
  { id: "exec_summary", title: "Executive summary", group: "The opportunity", core: true,
    help: "A tight overview an investor can read in 30 seconds. We can auto-write this from the rest.",
    prompt: "Write a 3–4 sentence executive summary covering what the company does, the market, the model, and the raise." },
  { id: "company_overview", title: "Company overview", group: "The opportunity", core: false,
    help: "Who you are and what you're building, in plain terms.",
    prompt: "Write a short company overview: what it is, who it's for, and the one-line vision." },
  { id: "problem", title: "Problem", group: "The opportunity", core: true,
    help: "Lead with the pain you solve — not the product.",
    prompt: "Describe the problem the company solves: who feels it, how often, and why it matters." },
  { id: "solution", title: "Solution / product", group: "The opportunity", core: true,
    help: "How you solve it, and why your way is better.",
    prompt: "Describe the product and how it solves the problem, with the key differentiator." },
  // The market
  { id: "market", title: "Market analysis (TAM/SAM/SOM)", group: "The market", core: true,
    help: "How big the opportunity is, and the slice you can realistically reach.",
    prompt: "Describe the market with a TAM, SAM and SOM and a one-line rationale for each." },
  { id: "competition", title: "Competitive landscape", group: "The market", core: true,
    help: "How you compare to alternatives — and your moat.",
    prompt: "Summarize the competitive landscape and the company's defensible advantage (moat)." },
  { id: "gtm", title: "Go-to-market", group: "The market", core: false,
    help: "How you'll reach customers, and your unit economics.",
    prompt: "Describe the go-to-market: primary channel(s), motion, and CAC/LTV if known." },
  // The business
  { id: "business_model", title: "Business model", group: "The business", core: true,
    help: "How you make money.",
    prompt: "Describe the revenue model, pricing, and gross margin." },
  { id: "traction", title: "Traction & milestones", group: "The business", core: true,
    help: "Proof points so far, and what's next.",
    prompt: "Summarize traction to date and the next 2–3 milestones." },
  { id: "team", title: "Team", group: "The business", core: true,
    help: "Why you're the team to win.",
    prompt: "Describe the founding team and why they're suited to this problem." },
  { id: "operations", title: "Operations", group: "The business", core: false,
    help: "How the business runs day to day (optional for early stage).",
    prompt: "Briefly describe key operations, suppliers, or infrastructure if relevant." },
  // The numbers
  { id: "projections", title: "Financial projections", group: "The numbers", core: true,
    help: "Driver-based — you confirm assumptions, we do the math.",
    prompt: "" },
  { id: "use_of_funds", title: "Use of funds & the ask", group: "The numbers", core: true,
    help: "What you're raising and where it goes.",
    prompt: "State the raise amount and the allocation of funds, tied to milestones." },
  { id: "risks", title: "Risks & mitigations", group: "The numbers", core: true,
    help: "An honest view of what could go wrong — and your plan.",
    prompt: "List 3 key risks, each with a one-line mitigation." },
  { id: "exit", title: "Exit strategy", group: "The numbers", core: false,
    help: "How investors could realize a return. Illustrative comparables only — never promised returns.",
    prompt: "Describe likely exit paths and probable acquirer categories. Use illustrative comparables only; never state a return multiple." },
];

export const SECTION_GROUPS = ["The opportunity", "The market", "The business", "The numbers"];

export function getSectionDef(id: string): BusinessPlanSectionDef | undefined {
  return BUSINESS_PLAN_SECTIONS.find((s) => s.id === id);
}
