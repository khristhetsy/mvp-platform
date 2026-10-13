/**
 * The master template every new founder IR agent starts from. Taken from the
 * Johnny IR agent (icapos.com/johnny). Founders edit wording, reorder, turn
 * questions off and add their own. Admin edits the master copy in Feature
 * Controls; changes reach new agents only.
 */
import { JOHNNY_QUESTIONS } from "@/lib/johnny/config";
import { OPTIONS, type FieldKey } from "@/lib/johnny/profile";

/** Field names as stored (investor_profiles) and as Johnny's engine knows them. */
export type ProfileField = "investor_type" | "preferred_sectors" | "check_size" | "preferred_stages" | "capital_types";
export type QuestionField = ProfileField | "custom";

export const FIELD_TO_KEY: Record<ProfileField, FieldKey> = {
  investor_type: "type",
  preferred_sectors: "sect",
  check_size: "check",
  preferred_stages: "stage",
  capital_types: "cap",
};
export const KEY_TO_FIELD: Record<FieldKey, ProfileField> = {
  type: "investor_type",
  sect: "preferred_sectors",
  check: "check_size",
  stage: "preferred_stages",
  cap: "capital_types",
};
export const FIELD_LABELS: Record<QuestionField, string> = {
  investor_type: "Investor type",
  preferred_sectors: "Industries",
  check_size: "Check size",
  preferred_stages: "Stages",
  capital_types: "Capital types",
  custom: "Custom question",
};

export interface TemplateQuestion {
  field: QuestionField;
  prompt: string;
  /** One tap buttons. Typing always works too. Empty means type only. */
  options: string[];
  enabled: boolean;
}

export interface TemplateContactField {
  key: string;
  label: string;
  kind: "short_text" | "email" | "phone";
  required: boolean;
  enabled: boolean;
}

export interface AgentTemplate {
  displayName: string;
  /** Two lines. {{company}} and {{name}} are replaced. The first question follows. */
  welcome: [string, string];
  questions: TemplateQuestion[];
  contactFields: TemplateContactField[];
}

export const DEFAULT_TEMPLATE: AgentTemplate = {
  displayName: "Investor Relations",
  welcome: [
    "{{name}} here. I handle investor relations at {{company}}.",
    "We would like to make sure what we send you is worth your time.",
  ],
  questions: [
    { field: "investor_type", prompt: "So, how do you usually invest?", options: [...OPTIONS.type], enabled: true },
    { field: "preferred_sectors", prompt: JOHNNY_QUESTIONS.sect[0], options: [...OPTIONS.sect], enabled: true },
    { field: "check_size", prompt: JOHNNY_QUESTIONS.check[0], options: [...OPTIONS.check], enabled: true },
    { field: "preferred_stages", prompt: JOHNNY_QUESTIONS.stage[0], options: [...OPTIONS.stage], enabled: true },
    { field: "capital_types", prompt: JOHNNY_QUESTIONS.cap[0], options: [...OPTIONS.cap], enabled: true },
  ],
  contactFields: [
    { key: "name", label: "Full name", kind: "short_text", required: true, enabled: true },
    { key: "email", label: "Email", kind: "email", required: true, enabled: true },
    { key: "phone", label: "Phone", kind: "phone", required: true, enabled: true },
    { key: "firm", label: "Firm", kind: "short_text", required: false, enabled: false },
  ],
};

/** Locked. Founders cannot edit or remove this line. {{company}} is replaced by the page. */
export const LOCKED_DISCLAIMER =
  "You are talking to an AI agent acting for {{company}}, not a person. This conversation is informational only. It is not an offer to sell securities or a solicitation to buy them, and it is not investment, legal or tax advice. Powered by iCapOS. iCFO Capital Global, Inc. is not a broker dealer or investment adviser.";

/** The notice a founder confirms before the agent goes live. Shown on the Build tab; the confirmation is stored on the agent. */
export const COMPLIANCE_NOTICE = {
  title: "Read this before your agent talks to investors",
  points: [
    {
      title: "Your agent is an AI, and it says so",
      body: "Every conversation carries a fixed line stating that visitors are talking to an AI agent acting for your company, not a person, and that nothing it says is an offer to sell securities or a solicitation to buy them. You cannot edit or remove that line. If a visitor asks whether it is a bot, it answers yes.",
    },
    {
      title: "Securities law applies to what your agent says",
      body: "Your agent speaks for your company. Under U.S. federal securities laws and the rules of the SEC, communications to prospective investors can count as an offer or a general solicitation, and the exemption you rely on (for example Regulation D Rule 506(b) or 506(c)) sets what you may say, to whom, and what you must verify. The agent is built to never state a price, valuation, percentage, projected return or funding promise, and to answer only from facts you give it. That is a guardrail, not a legal review. You are responsible for what you teach it, for the documents you upload, and for how you share the link.",
    },
    {
      title: "Seek your own legal counsel",
      body: "iCFO Capital Global, Inc. and iCapOS are not a broker dealer, investment adviser, funding portal or law firm, and this page is not legal advice. Before your agent goes live, have a securities attorney review your fact sheet, your taught answers, your uploaded materials and the channels you plan to post the link on.",
    },
  ],
  acknowledgement:
    "I have read this notice. I understand my agent is an AI that speaks for my company, that securities laws apply to what it says, and that I should consult my own legal counsel before sharing the link with investors.",
} as const;

export const SLOT_MINUTES = 30;

/** Accept a stored template, falling back to the default for anything missing or malformed. */
export function normalizeTemplate(raw: unknown): AgentTemplate {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<AgentTemplate>;
  const str = (v: unknown, fallback: string, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fallback);
  const welcome: [string, string] = Array.isArray(r.welcome)
    ? [str(r.welcome[0], DEFAULT_TEMPLATE.welcome[0]), str(r.welcome[1], DEFAULT_TEMPLATE.welcome[1])]
    : DEFAULT_TEMPLATE.welcome;
  const fields = new Set<string>(["investor_type", "preferred_sectors", "check_size", "preferred_stages", "capital_types", "custom"]);
  const questions = Array.isArray(r.questions)
    ? r.questions
        .filter((q): q is TemplateQuestion => Boolean(q) && typeof q === "object" && fields.has(String((q as TemplateQuestion).field)))
        .map((q) => ({
          field: q.field,
          prompt: str(q.prompt, "", 200),
          options: Array.isArray(q.options) ? q.options.map((o) => String(o).trim().slice(0, 40)).filter(Boolean).slice(0, 12) : [],
          enabled: q.enabled !== false,
        }))
        .filter((q) => q.prompt)
    : [];
  const kinds = new Set(["short_text", "email", "phone"]);
  const contactFields = Array.isArray(r.contactFields)
    ? r.contactFields
        .filter((c): c is TemplateContactField => Boolean(c) && typeof c === "object" && kinds.has(String((c as TemplateContactField).kind)))
        .map((c) => ({
          key: String(c.key).toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30),
          label: str(c.label, "", 40),
          kind: c.kind,
          required: c.required === true,
          enabled: c.enabled !== false,
        }))
        .filter((c) => c.key && c.label)
    : [];
  return {
    displayName: str(r.displayName, DEFAULT_TEMPLATE.displayName, 60),
    welcome,
    questions: questions.length ? questions : DEFAULT_TEMPLATE.questions,
    contactFields: contactFields.length ? contactFields : DEFAULT_TEMPLATE.contactFields,
  };
}
