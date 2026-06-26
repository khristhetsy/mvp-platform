// iCFO Events — domain types. Mirrors the Phase 0 schema in
// supabase/migrations/20260626001_icfo_events.sql. These tables aren't in the
// generated Supabase types yet, so the query layer uses a local raw() cast.

export type EventStatus = "draft" | "published" | "live" | "ended" | "archived";
export type EventFormat = "showcase" | "demo_day" | "webinar" | "hybrid";
export type EventVisibility = "public" | "members";
export type SessionType = "keynote" | "panel" | "talk_show" | "founder_showcase" | "workshop";
export type SessionStatus = "draft" | "scheduled" | "live" | "ended";

export interface EventSectorTrack {
  id: string;
  eventId: string;
  sectorSlug: string;
  label: string;
}

export interface EventSession {
  id: string;
  eventId: string;
  sectorSlug: string | null;
  title: string;
  abstract: string | null;
  type: SessionType;
  status: SessionStatus;
  startsAt: string | null;
  endsAt: string | null;
  videoProvider: string | null;
  videoRef: string | null;
  recordingPath: string | null;
  position: number;
}

export interface EventRecord {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  status: EventStatus;
  format: EventFormat;
  visibility: EventVisibility;
  startsAt: string | null;
  endsAt: string | null;
  coverPath: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

/** An event with its sector tracks and (optionally) sessions, for detail views. */
export interface EventWithDetail extends EventRecord {
  sectors: EventSectorTrack[];
  sessions: EventSession[];
}

export type EventActivityType =
  | "created"
  | "updated"
  | "published"
  | "unpublished"
  | "archived"
  | "session_added";
