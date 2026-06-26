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
  | "session_added"
  | "presenter_approved"
  | "presenter_declined"
  | "sponsor_added";

// ── Phase 1 ────────────────────────────────────────────────────────────────────

export type SpeakerApplicationKind = "presenter" | "panelist" | "founder_showcase";
export type SpeakerApplicationStatus = "submitted" | "under_review" | "approved" | "declined";
export type RegistrationStatus = "registered" | "attended" | "no_show";
export type SponsorTier = "presenting" | "gold" | "silver" | "community";
export type SponsorCategory = "legal" | "consulting" | "banking" | "other";
export type EventSponsorPlacement = "presenting" | "track" | "logo";

export interface SpeakerApplication {
  id: string;
  eventId: string;
  applicantId: string;
  applicantRole: string;
  kind: SpeakerApplicationKind;
  topic: string;
  bio: string | null;
  sectorSlug: string | null;
  links: string[];
  status: SpeakerApplicationStatus;
  rubricScores: Record<string, number>;
  reviewerId: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  // joined display fields (optional)
  applicantName?: string | null;
  eventTitle?: string | null;
}

export interface EventPresenter {
  id: string;
  eventId: string;
  sessionId: string | null;
  applicationId: string | null;
  profileId: string | null;
  displayName: string;
  roleLabel: string | null;
  headshotPath: string | null;
  position: number;
}

export interface Sponsor {
  id: string;
  name: string;
  logoPath: string | null;
  blurb: string | null;
  website: string | null;
  tier: SponsorTier;
  sectorSlug: string | null;
  category: SponsorCategory;
  categoryExclusive: boolean;
  ownerId: string | null;
}

export interface SponsorLead {
  id: string;
  sponsorId: string;
  profileId: string;
  attendeeName: string | null;
  eventId: string | null;
  eventTitle: string | null;
  message: string | null;
  createdAt: string;
}

export interface EventSponsor extends Sponsor {
  eventSponsorId: string;
  placement: EventSponsorPlacement;
  logoUrl?: string | null;
}

export interface NetworkingOptin {
  id: string;
  eventId: string;
  profileId: string;
  optedIn: boolean;
  interests: string[];
}

/** Rubric dimensions scored by reviewers (0–5 each). */
export const RUBRIC_DIMENSIONS = ["relevance", "credibility", "sector_fit", "audience_value"] as const;
export type RubricDimension = (typeof RUBRIC_DIMENSIONS)[number];
