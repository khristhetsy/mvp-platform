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

/** Per-field config for the standard invitee contact fields on the booking form. */
export interface ContactFieldConfig {
  /** Name + Email are always collected (email is needed for the invite); only their
   *  label and required flag are configurable. Phone + Company can be turned off. */
  name: { label: string; required: boolean };
  email: { label: string; required: boolean };
  phone: { label: string; collect: boolean; required: boolean };
  company: { label: string; collect: boolean; required: boolean };
}

export const DEFAULT_CONTACT_FIELDS: ContactFieldConfig = {
  name: { label: "Full name", required: true },
  email: { label: "Email", required: true },
  phone: { label: "Phone", collect: true, required: false },
  company: { label: "Company", collect: false, required: false },
};

/** Merge a stored (possibly partial/null) contact-fields config over the defaults,
 *  so a missing column or a newly-added sub-key always resolves to a safe value. */
export function resolveContactFields(raw: Partial<ContactFieldConfig> | null | undefined): ContactFieldConfig {
  const d = DEFAULT_CONTACT_FIELDS;
  const r = raw ?? {};
  return {
    name: { label: r.name?.label ?? d.name.label, required: r.name?.required ?? d.name.required },
    email: { label: r.email?.label ?? d.email.label, required: r.email?.required ?? d.email.required },
    phone: { label: r.phone?.label ?? d.phone.label, collect: r.phone?.collect ?? d.phone.collect, required: r.phone?.required ?? d.phone.required },
    company: { label: r.company?.label ?? d.company.label, collect: r.company?.collect ?? d.company.collect, required: r.company?.required ?? d.company.required },
  };
}

/** A user's saved scheduling preferences. */
export interface AvailabilitySettings {
  timezone: string;
  /** Default/primary meeting length (kept as slotDurations[0] for back-compat). */
  slotMinutes: number;
  /** Meeting lengths the host offers; the booker picks one. Always ≥1 item. */
  slotDurations: number[];
  bufferMinutes: number;
  weeklyRules: WeeklyRule[];
  /** Custom meeting name shown on the booking page. */
  meetingTitle: string;
  /** Custom intake questions shown on the booking form. */
  questions: ScheduleQuestion[];
  /** Standard invitee contact fields (labels, collect, required). */
  contactFields: ContactFieldConfig;
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
  slotDurations: [30, 60],
  bufferMinutes: 0,
  meetingTitle: "",
  questions: [],
  contactFields: DEFAULT_CONTACT_FIELDS,
  // Mon–Fri, 9:00–17:00 local.
  weeklyRules: [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    startMinute: 9 * 60,
    endMinute: 17 * 60,
  })),
};
