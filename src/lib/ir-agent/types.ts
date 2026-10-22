import type { AgentType } from "./agent-types";
import type { QuestionField, TemplateContactField } from "./defaults";

/** A question as the agent asks it. Profile questions map onto Johnny's fields; custom ones are stored as text. */
export interface AgentQuestion {
  id: string;
  field: QuestionField;
  prompt: string;
  options: string[];
  enabled: boolean;
  position: number;
}

export interface AgentContactField extends TemplateContactField {
  id: string;
  position: number;
}

export interface TaughtAnswer {
  id: string;
  question: string;
  answer: string;
}

/** Everything the chat component needs. Safe to send to the browser: no tokens, no source text. */
export interface AgentPublicConfig {
  id: string;
  companySlug: string;
  ending: string;
  companyName: string;
  displayName: string;
  imageUrl: string | null;
  /** The two opening lines with {{company}} and {{name}} already replaced. */
  welcome: string[];
  disclaimer: string;
  hostProfileId: string | null;
  slotMinutes: number;
  questions: AgentQuestion[];
  contactFields: AgentContactField[];
  taughtAnswers: TaughtAnswer[];
  /** False while the host has no availability set: the agent then links to the calendar page instead of offering times. */
  bookingReady: boolean;
  /** Demo and internal accounts: never send real email or create real bookings. */
  demo: boolean;
}

export interface AgentRow {
  id: string;
  organization_id: string;
  company_slug: string;
  ending: string;
  company_name: string;
  display_name: string;
  welcome_message: string | null;
  about: string | null;
  image_url: string | null;
  status: "draft" | "live" | "paused";
  template_version: number;
  host_profile_id: string | null;
  created_by: string | null;
  compliance_acknowledged_at: string | null;
  compliance_acknowledged_by: string | null;
  /** Company profile fields kept out of the agent (keys from wired.ts). */
  wired_excluded?: string[];
  /** Which kind of agent this is. Loads its own question set. */
  agent_type?: AgentType;
  created_at: string;
  updated_at: string;
}
