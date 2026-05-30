export type MessageThreadStatus = "requested" | "active" | "closed" | "archived";

export type ThreadMessageType =
  | "user_message"
  | "system_note"
  | "intro_request"
  | "follow_up"
  | "meeting_request"
  | "meeting_scheduled";

export type ThreadMeetingStatus = "proposed" | "accepted" | "declined" | "canceled" | "scheduled";

export type MessageThreadRecord = {
  id: string;
  company_id: string;
  founder_id: string;
  investor_id: string;
  intro_request_id: string | null;
  status: MessageThreadStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ThreadMessageRecord = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  message_type: ThreadMessageType;
  created_at: string;
  read_at: string | null;
};

export type ThreadMeetingRecord = {
  id: string;
  thread_id: string;
  company_id: string;
  founder_id: string;
  investor_id: string;
  requested_by: string;
  status: ThreadMeetingStatus;
  proposed_start_time: string | null;
  proposed_end_time: string | null;
  timezone: string | null;
  meeting_title: string | null;
  meeting_notes: string | null;
  external_calendar_provider: string | null;
  external_calendar_event_id: string | null;
  external_meet_url: string | null;
  calendar_host_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageThreadListItem = MessageThreadRecord & {
  company_name: string | null;
  investor_name: string | null;
  founder_name: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  meeting_status: ThreadMeetingStatus | null;
};

export type MessageThreadDetail = {
  thread: MessageThreadRecord;
  company_name: string | null;
  investor_name: string | null;
  founder_name: string | null;
  messages: ThreadMessageRecord[];
  meetings: ThreadMeetingRecord[];
  intro_request_message: string | null;
};
