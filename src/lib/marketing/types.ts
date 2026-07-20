export type MarketingContact = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  source: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Enriched from crm_contacts (matched by email) when getContacts({ enrich: true }).
  phone?: string | null;
  membership?: string | null;
  type?: string | null;
  assignees?: string[];
};

export type MarketingList = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  contact_count?: number;
};

export type MarketingTemplate = {
  id: string;
  name: string;
  subject: string;
  preview_text: string | null;
  html_body: string;
  text_body: string | null;
  /** Structured blocks for the visual editor; html_body is regenerated from these. */
  blocks?: unknown;
  status: "draft" | "active" | "archived";
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketingCampaign = {
  id: string;
  name: string;
  list_id: string | null;
  template_id: string | null;
  status: "draft" | "scheduled" | "sending" | "sent" | "paused" | "cancelled";
  scheduled_at: string | null;
  sent_at: string | null;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  subject_override: string | null;
  body_override: string | null;
  stat_sent: number;
  stat_delivered: number;
  stat_opened: number;
  stat_clicked: number;
  stat_replied: number;
  stat_bounced: number;
  stat_spam: number;
  stat_unsubscribed: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived?: boolean;
  group_type?: "founder" | "investor" | "event" | null;
  // joined
  list?: MarketingList | null;
  template?: MarketingTemplate | null;
};

export type MarketingSequence = {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "archived";
  created_by: string | null;
  created_at: string;
  updated_at: string;
  steps?: MarketingSequenceStep[];
  enrollment_count?: number;
};

export type MarketingSequenceStep = {
  id: string;
  sequence_id: string;
  step_order: number;
  template_id: string | null;
  delay_days: number;
  condition: "always" | "no_open" | "no_click" | "no_reply";
  from_name: string;
  from_email: string;
  created_at: string;
  template?: MarketingTemplate | null;
};

export type MarketingEvent = {
  id: string;
  campaign_id: string | null;
  sequence_id: string | null;
  step_id: string | null;
  contact_id: string;
  email: string;
  resend_id: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
};

export type SendResult = {
  resend_id: string | null;
  ok: boolean;
  error?: string;
};

// ---------------------------------------------------------------------------
// Marketing plan / strategy
// ---------------------------------------------------------------------------

export type MarketingPlanStatus = "draft" | "active" | "archived";

export type MarketingPlanItemChannel =
  | "email"
  | "content"
  | "social"
  | "paid"
  | "events"
  | "pr"
  | "seo"
  | "partnerships"
  | "other";

export type MarketingPlanItemStatus = "planned" | "in_progress" | "done";
export type MarketingPlanItemPriority = "low" | "medium" | "high";

export type MarketingPlan = {
  id: string;
  name: string;
  objective: string | null;
  summary: string | null;
  target_audience: string | null;
  budget: string | null;
  status: MarketingPlanStatus;
  start_date: string | null;
  end_date: string | null;
  generated_by: "manual" | "claude";
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  items?: MarketingPlanItem[];
  item_count?: number;
};

export type MarketingPlanItem = {
  id: string;
  plan_id: string;
  title: string;
  description: string | null;
  channel: MarketingPlanItemChannel;
  status: MarketingPlanItemStatus;
  priority: MarketingPlanItemPriority;
  start_date: string | null;
  due_date: string | null;
  sort_order: number;
  task_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Shape returned by the AI CMO before it is persisted. */
export type CmoPlanDraft = {
  name: string;
  objective: string;
  summary: string;
  target_audience: string;
  budget: string | null;
  items: Array<{
    title: string;
    description: string;
    channel: MarketingPlanItemChannel;
    priority: MarketingPlanItemPriority;
  }>;
  generatedBy: "claude" | "unconfigured";
  isDemo: boolean;
};
