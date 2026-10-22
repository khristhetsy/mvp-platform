/**
 * AI Agent Type: which kind of agent is being built. Each type loads its own
 * question set (what the agent asks a visitor), opening lines, and the role the
 * reply prompt plays. One agent per company: switching type replaces the
 * questions, name and welcome with the new type's set.
 *
 * Founder keeps the master template (Feature Controls), so the admin can still
 * edit it. The other types come from here. Company facts for every type come
 * from the Company profile (wired.ts), never from a question.
 */
import { OPTIONS } from "@/lib/johnny/profile";
import { DEFAULT_TEMPLATE, type AgentTemplate, type TemplateQuestion } from "./defaults";

export const AGENT_TYPES = ["founder", "investor", "sales", "marketing", "ir"] as const;
export type AgentType = (typeof AGENT_TYPES)[number];
export const DEFAULT_AGENT_TYPE: AgentType = "founder";

export type AgentTypeSpec = {
  id: AgentType;
  label: string;
  /** One line for the selector card. */
  description: string;
  /** True when company details come from the Company profile instead of questions. */
  fromProfile: boolean;
  displayName: string;
  welcome: [string, string];
  /** Used in the reply prompt: "You are NAME, the ROLE for COMPANY." */
  role: string;
  /** Used in the reply prompt: what the conversation is for. */
  goal: string;
  questions: TemplateQuestion[];
};

const q = (prompt: string, options: string[] = [], field: TemplateQuestion["field"] = "custom"): TemplateQuestion => ({ field, prompt, options, enabled: true });

export const AGENT_TYPE_SPECS: Record<AgentType, AgentTypeSpec> = {
  founder: {
    id: "founder",
    label: "Founder",
    description: "Qualifies the investors you want to reach for your raise.",
    fromProfile: false,
    displayName: DEFAULT_TEMPLATE.displayName,
    welcome: DEFAULT_TEMPLATE.welcome,
    role: "investor relations agent",
    goal: "learn how they invest ({asked}) and move them toward a 30 minute call with the founder, where the company is presented properly",
    questions: DEFAULT_TEMPLATE.questions,
  },
  investor: {
    id: "investor",
    label: "Investor",
    description: "Screens inbound deal flow against what you invest in.",
    fromProfile: false,
    displayName: "Deal Flow",
    welcome: ["{{name}} here. I handle deal flow at {{company}}.", "We would like to make sure a conversation is worth your time and ours."],
    role: "deal flow agent",
    goal: "learn what the visitor is building ({asked}) and, where it fits, move them toward a call. Never imply interest in investing or any commitment",
    questions: [
      q("What does your company do?"),
      q("What stage are you at?", ["Pre seed", "Seed", "Series A", "Series B", "Growth"]),
      q("Which sector are you in?"),
      q("Where is the company based?"),
      q("About how much are you raising?", ["Under $250K", "$250K to $1M", "$1M to $5M", "Over $5M"]),
      q("Do you have revenue today?", ["Yes", "Not yet"]),
    ],
  },
  sales: {
    id: "sales",
    label: "Sales",
    description: "Qualifies leads and books a sales call. Company details come from the Company profile.",
    fromProfile: true,
    displayName: "Sales",
    welcome: ["{{name}} here. I handle sales questions at {{company}}.", "Tell me a little about what you need and I will point you the right way."],
    role: "sales agent",
    goal: "understand what the visitor needs ({asked}), answer from the company facts, and move them toward a call with the team",
    questions: [
      q("What are you hoping to solve?", ["Learn more", "See a demo", "Pricing and plans", "Something else"]),
      q("What does your company do, and what is your role?"),
      q("How big is your team?", ["Just me", "2 to 10", "11 to 50", "Over 50"]),
      q("When are you looking to start?", ["This month", "This quarter", "Later", "Just exploring"]),
    ],
  },
  marketing: {
    id: "marketing",
    label: "Marketing",
    description: "Shares campaigns and messaging, and learns what visitors care about. Company details come from the Company profile.",
    fromProfile: true,
    displayName: "Marketing",
    welcome: ["{{name}} here. I handle marketing at {{company}}.", "Let me know what you would like to hear about."],
    role: "marketing agent",
    goal: "share what the company offers, using only the facts above, and learn what the visitor cares about ({asked})",
    questions: [
      q("What would you like to hear about?", ["Product news", "Events", "Partnerships", "Something else"]),
      q("Which best describes you?", ["Customer", "Prospect", "Partner", "Press", "Other"]),
      q("How do you prefer to hear from us?", ["Email", "LinkedIn", "Events", "Social media"]),
    ],
  },
  ir: {
    id: "ir",
    label: "Investor Relations",
    description: "Handles investor updates and outreach. Company details come from the Company profile.",
    fromProfile: true,
    displayName: "Investor Relations",
    welcome: DEFAULT_TEMPLATE.welcome,
    role: "investor relations agent",
    goal: "learn how the visitor invests and what updates they want ({asked}), and move them toward a call with the founder",
    questions: [
      { field: "investor_type", prompt: "So, how do you usually invest?", options: [...OPTIONS.type], enabled: true },
      q("Which updates are useful to you?", ["Milestones", "Financial highlights", "Product progress", "Events"]),
      q("How often would you like to hear from us?", ["Monthly", "Quarterly", "Per milestone"]),
    ],
  },
};

/** Sales, Marketing and Investor Relations agents are built by Admin membership. Founder and Investor are open to everyone. */
export const ADMIN_ONLY_TYPES: readonly AgentType[] = ["sales", "marketing", "ir"];
/** What an admin starts with: the first Admin option. */
export const ADMIN_DEFAULT_TYPE: AgentType = "sales";
export function isAdminOnlyType(type: AgentType): boolean {
  return ADMIN_ONLY_TYPES.includes(type);
}

export function isAgentType(v: unknown): v is AgentType {
  return typeof v === "string" && (AGENT_TYPES as readonly string[]).includes(v);
}

/** The template a new agent of this type starts from. Founder uses the master template as edited in Feature Controls. */
export function templateForType(type: AgentType, master: AgentTemplate): AgentTemplate {
  if (type === "founder") return master;
  const s = AGENT_TYPE_SPECS[type];
  return { displayName: s.displayName, welcome: s.welcome, questions: s.questions, contactFields: master.contactFields };
}
