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
