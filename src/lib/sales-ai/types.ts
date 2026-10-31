/**
 * Sales AI agent: shared types.
 *
 * The agent is one built in the AI Agent module (ir_agents). Here it is assigned
 * to a sales opportunity, reads that opportunity's conversation, and prepares an
 * audit plus an email draft for a person to review. It never sends or moves a
 * stage on its own.
 */

export const OBJECTIONS = ["value", "money", "timing", "team", "fence", "ready", "unknown"] as const;
export type Objection = (typeof OBJECTIONS)[number];

/** One line of the audit. `sources` are the provenance tags shown beside it. */
export type AuditPoint = {
  label: string;
  text: string;
  sources: string[];
  /** True when `text` is the prospect's own words, copied verbatim. */
  quote?: boolean;
};

export type ChannelRead = { name: string; count: number; read: boolean };

export type Audit = {
  points: AuditPoint[];
  channels: ChannelRead[];
  /** Fields the record does not hold. Said plainly instead of filled in. */
  notOnFile: string[];
  asked: string | null;
  concern: string | null;
  objection: Objection;
  technique: string;
  closingQuestion: string;
  /** False when no AI key is configured, so only record facts were read. */
  aiRead: boolean;
};

/** The written parts of an email. Quotes are the prospect's words and are kept out of guard checks. */
export type DraftParts = {
  greeting: string;
  /** Lines in order. `quote` lines are the prospect's own words and are not guard checked. */
  intro: Array<{ text: string; quote: boolean }>;
  value: string;
  refund: string | null;
  question: string;
  link: string | null;
};

export type DraftStatus = "draft" | "sent" | "discarded";

export type SalesAiDraft = {
  id: string;
  opportunityId: string;
  agentId: string | null;
  stageId: string | null;
  objection: Objection;
  technique: string | null;
  audit: Audit;
  subject: string;
  body: string;
  bodyParts: DraftParts | null;
  includeRefundOffer: boolean;
  chatUrl: string | null;
  status: DraftStatus;
  createdAt: string;
  sentAt: string | null;
};

export type AgentOption = {
  id: string;
  name: string;
  companyName: string;
  agentType: string;
  /** Only a live agent has a public chat to link to. */
  live: boolean;
};

export type StageSuggestion = {
  id: string;
  opportunityId: string;
  fromStageId: string | null;
  toStageId: string;
  toStageName: string;
  reason: string;
  source: string;
  status: "pending" | "applied" | "dismissed";
  createdAt: string;
};

export type SalesAiState = {
  stageActive: boolean;
  stageName: string | null;
  agentId: string | null;
  chatTag: string | null;
  chatUrl: string | null;
  agents: AgentOption[];
  draft: SalesAiDraft | null;
  suggestions: StageSuggestion[];
  aiConfigured: boolean;
};
