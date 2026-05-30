export type FounderInvestorContactStatus =
  | "new"
  | "researching"
  | "selected"
  | "contacted"
  | "responded"
  | "meeting_scheduled"
  | "not_interested"
  | "archived";

export type FounderOutreachTargetStatus =
  | "recommended"
  | "selected"
  | "intro_requested"
  | "contacted"
  | "responded"
  | "meeting_scheduled"
  | "declined"
  | "archived";

export type OutreachCampaignStatus = "draft" | "queued" | "active" | "paused" | "completed" | "canceled";

export type OutreachMessageStatus = "draft" | "queued" | "sent" | "replied" | "bounced" | "canceled";

export type FounderInvestorContactRecord = {
  id: string;
  founder_id: string;
  company_id: string;
  investor_name: string;
  firm_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  investor_type: string | null;
  preferred_sectors: string | null;
  preferred_stages: string | null;
  check_size_min: number | null;
  check_size_max: number | null;
  geography: string | null;
  source: string;
  tags: string[];
  notes: string | null;
  status: FounderInvestorContactStatus;
  created_at: string;
  updated_at: string;
};

export type FounderOutreachTargetRecord = {
  id: string;
  company_id: string;
  founder_id: string;
  contact_id: string | null;
  platform_investor_id: string | null;
  match_score: number | null;
  status: FounderOutreachTargetStatus;
  source: string;
  notes: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OutreachCampaignRecord = {
  id: string;
  founder_id: string;
  company_id: string;
  name: string;
  status: OutreachCampaignStatus;
  audience_count: number;
  daily_limit: number;
  created_at: string;
  updated_at: string;
};

export type OutreachMessageRecord = {
  id: string;
  campaign_id: string;
  contact_id: string;
  subject: string;
  body: string;
  status: OutreachMessageStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  created_at: string;
};

export const OUTREACH_DAILY_LIMIT_MAX = 25;
