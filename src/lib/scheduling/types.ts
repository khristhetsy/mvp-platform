/** A time interval as ISO-8601 instants (UTC). */
export interface TimeInterval {
  start: string;
  end: string;
}

/** One bookable window in a user's week. Minutes are from local midnight. */
export interface WeeklyRule {
  /** 0 = Sunday … 6 = Saturday, in the user's local timezone. */
  weekday: number;
  /** Inclusive start, minutes from local midnight (0–1439). */
  startMinute: number;
  /** Exclusive end, minutes from local midnight (1–1440). */
  endMinute: number;
}

/** A host-configured intake question shown on the booking form. */
export interface ScheduleQuestion {
  id: string;
  label: string;
  type: "short_text" | "single" | "multi";
  options: string[];
  required: boolean;
}

/** A user's saved scheduling preferences. */
export interface AvailabilitySettings {
  timezone: string;
  slotMinutes: number;
  bufferMinutes: number;
  weeklyRules: WeeklyRule[];
  /** Custom meeting name shown on the booking page. */
  meetingTitle: string;
  /** Custom intake questions shown on the booking form. */
  questions: ScheduleQuestion[];
}

/** Engine config: settings resolved to a concrete UTC offset for the range. */
export interface AvailabilityConfig {
  weeklyRules: WeeklyRule[];
  slotMinutes: number;
  bufferMinutes: number;
  /** Minutes to ADD to UTC to get local time (e.g. UTC−5 → −300). */
  timezoneOffsetMinutes: number;
}

/** A calendar event as stored in our calendar_events table. */
export interface CalendarEventRecord {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  timezone: string;
  all_day: boolean;
  location: string | null;
  attendees: Array<{ email: string; name?: string }>;
  meet_url: string | null;
  source: "capitalos" | "google";
  external_provider: string | null;
  external_event_id: string | null;
  status: "confirmed" | "cancelled";
  created_at: string;
  updated_at: string;
}

export const DEFAULT_AVAILABILITY: AvailabilitySettings = {
  timezone: "UTC",
  slotMinutes: 30,
  bufferMinutes: 0,
  meetingTitle: "",
  questions: [],
  // Mon–Fri, 9:00–17:00 local.
  weeklyRules: [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    startMinute: 9 * 60,
    endMinute: 17 * 60,
  })),
};
