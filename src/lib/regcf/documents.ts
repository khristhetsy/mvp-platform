// Definitions for the founder Reg CF AI Materials Generator.
// These produce DRAFT disclosure/prep content only — no offering, transaction,
// or signature. The founder owns and is responsible for the output.

export type RegCfDocKey =
  | "business_summary"
  | "use_of_proceeds"
  | "risk_factors"
  | "financial_narrative"
  | "form_c"
  | "pitch_outline"
  | "investor_faq"
  | "one_pager"
  | "notice_204b";

export interface RegCfDocDef {
  key: RegCfDocKey;
  label: string;
  description: string;
  /** Sensitive SEC-filing content that should be reviewed by counsel. */
  counsel: boolean;
  /** Guidance handed to the model when drafting this document. */
  instruction: string;
}

export const REGCF_DOCS: RegCfDocDef[] = [
  {
    key: "business_summary",
    label: "Business summary",
    description: "Company, team, product, and traction overview.",
    counsel: false,
    instruction:
      "Write a concise, factual business summary covering what the company does, the problem it solves, the product, the team's relevant background, the market, and current traction. Plain professional prose, ~250-400 words.",
  },
  {
    key: "use_of_proceeds",
    label: "Use of proceeds",
    description: "How the raised funds will be allocated.",
    counsel: false,
    instruction:
      "Draft a 'use of proceeds' section describing how the company would allocate raised funds across categories (e.g., product/engineering, sales & marketing, operations, reserve). Present an illustrative percentage breakdown and note that allocations are estimates that may be reallocated.",
  },
  {
    key: "risk_factors",
    label: "Risk factors",
    description: "Key risks investors should consider.",
    counsel: false,
    instruction:
      "Draft a balanced list of material risk factors a prospective investor should consider, tailored to this company and its stage. Include standard early-stage risks (limited operating history, illiquidity, possible total loss, dilution, competition) plus company-specific risks. Each risk: a bold lead-in then a sentence.",
  },
  {
    key: "financial_narrative",
    label: "Financial narrative",
    description: "Plain-language summary of the financials.",
    counsel: false,
    instruction:
      "Write a plain-language financial narrative summarizing revenue, growth, margins, net loss, cash, and burn, and what the raise would fund. Note that formal financial statements at the required Reg CF disclosure tier are provided separately. Use only figures present in the provided context; use [brackets] for anything not provided.",
  },
  {
    key: "form_c",
    label: "Form C content draft",
    description: "Working draft of Form C disclosure content.",
    counsel: true,
    instruction:
      "Draft working CONTENT for the narrative sections of an SEC Form C offering statement under Regulation Crowdfunding: the company & business, directors/officers/20%+ holders, use of proceeds, ownership & capital structure, financial condition, risk factors summary, related-party transactions, and ongoing reporting. Use [brackets] for anything not provided. Begin with a clear note that this is a draft for the issuer and counsel, is not a filing, and that counsel prepares and files the actual Form C.",
  },
  {
    key: "pitch_outline",
    label: "Pitch deck outline",
    description: "A narrative outline for the founder's deck.",
    counsel: false,
    instruction:
      "Produce a slide-by-slide pitch deck outline (problem, solution, product, market, traction, business model, team, the ask) with 1-2 bullet prompts per slide tailored to this company.",
  },
  {
    key: "investor_faq",
    label: "Investor FAQ",
    description: "Common investor questions, pre-answered.",
    counsel: false,
    instruction:
      "Draft an investor FAQ of 6-8 question/answer pairs covering what the company does, the market, traction, the team, how the funds are used, and the risks. Factual and concise.",
  },
  {
    key: "one_pager",
    label: "One-page overview",
    description: "A concise company overview the founder owns.",
    counsel: false,
    instruction:
      "Write a tight one-page company overview: a one-line description, the problem/solution, key traction stats, the team, and what the company is working toward. Skimmable.",
  },
  {
    key: "notice_204b",
    label: "Rule 204(b) notice",
    description: "Compliant tombstone notice directing to the intermediary.",
    counsel: true,
    instruction:
      "Draft a short Regulation Crowdfunding Rule 204(b) 'tombstone' notice. It must be limited to: a statement that the issuer is conducting an offering pursuant to Section 4(a)(6) of the Securities Act, the name of the registered intermediary, a link/direction to the intermediary's platform, the terms of the offering (amount, security type, price, deadline, use of proceeds), and brief factual identification of the issuer (name, address, website, brief description). Do NOT add marketing language, projections, or persuasion. Use [brackets] for the intermediary name and link.",
  },
];

export const REGCF_DOC_KEYS: RegCfDocKey[] = REGCF_DOCS.map((d) => d.key);

export function isRegCfDocKey(v: string): v is RegCfDocKey {
  return (REGCF_DOC_KEYS as string[]).includes(v);
}

export function regCfDoc(key: RegCfDocKey): RegCfDocDef {
  return REGCF_DOCS.find((d) => d.key === key) as RegCfDocDef;
}
