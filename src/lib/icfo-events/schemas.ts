import { z } from "zod";
import { EVENT_SECTORS, isValidSectorSlug } from "./sectors";

const sectorSlug = z.string().refine(isValidSectorSlug, { message: "Unknown sector" });

/** An event may span every available sector track. */
const MAX_SECTOR_TRACKS = EVENT_SECTORS.length;

export const sectorTrackInput = z.object({
  sectorSlug,
  label: z.string().min(1).max(120),
});

export const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().max(2000).nullable().optional(),
  format: z.enum(["showcase", "demo_day", "webinar", "hybrid"]).default("showcase"),
  visibility: z.enum(["public", "members"]).default("public"),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  sectors: z.array(sectorTrackInput).max(MAX_SECTOR_TRACKS).default([]),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  summary: z.string().max(2000).nullable().optional(),
  format: z.enum(["showcase", "demo_day", "webinar", "hybrid"]).optional(),
  visibility: z.enum(["public", "members"]).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  sectors: z.array(sectorTrackInput).max(MAX_SECTOR_TRACKS).optional(),
});
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const publishEventSchema = z.object({
  action: z.enum(["publish", "unpublish", "archive"]),
});
export type PublishEventInput = z.infer<typeof publishEventSchema>;

// ── Phase 1 ────────────────────────────────────────────────────────────────────

export const speakerApplicationSchema = z.object({
  eventId: z.string().uuid(),
  kind: z.enum(["presenter", "panelist", "founder_showcase"]).default("presenter"),
  topic: z.string().min(1).max(200),
  bio: z.string().max(3000).nullable().optional(),
  sectorSlug: sectorSlug.nullable().optional(),
  links: z.array(z.string().url()).max(6).default([]),
});
export type SpeakerApplicationInput = z.infer<typeof speakerApplicationSchema>;

export const applicationDecisionSchema = z.object({
  action: z.enum(["approve", "decline", "review"]),
  note: z.string().max(2000).optional(),
  rubricScores: z.record(z.string(), z.number().min(0).max(5)).optional(),
  sessionId: z.string().uuid().nullable().optional(),
  roleLabel: z.string().max(120).optional(),
});
export type ApplicationDecisionInput = z.infer<typeof applicationDecisionSchema>;

export const sessionInput = z.object({
  title: z.string().min(1).max(200),
  abstract: z.string().max(4000).nullable().optional(),
  type: z.enum(["keynote", "panel", "talk_show", "founder_showcase", "workshop"]).default("keynote"),
  status: z.enum(["draft", "scheduled", "live", "ended"]).default("scheduled"),
  sectorSlug: sectorSlug.nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  recordingPath: z.string().max(500).nullable().optional(),
  hostSponsorId: z.string().uuid().nullable().optional(),
  position: z.number().default(0),
});
export type SessionInput = z.infer<typeof sessionInput>;

export const sponsorInput = z.object({
  name: z.string().min(1).max(160),
  blurb: z.string().max(1000).nullable().optional(),
  website: z.string().url().nullable().optional(),
  logoPath: z.string().max(500).nullable().optional(),
  tier: z.enum(["presenting", "gold", "silver", "community"]).default("community"),
  category: z.enum(["legal", "consulting", "banking", "other"]).default("other"),
  sectorSlug: sectorSlug.nullable().optional(),
  categoryExclusive: z.boolean().default(false),
});
export type SponsorInput = z.infer<typeof sponsorInput>;

export const linkSponsorSchema = z.object({
  sponsorId: z.string().uuid(),
  placement: z.enum(["presenting", "track", "logo"]).default("logo"),
});
export type LinkSponsorInput = z.infer<typeof linkSponsorSchema>;

export const networkingOptinSchema = z.object({
  eventId: z.string().uuid(),
  optedIn: z.boolean(),
  interests: z.array(z.string().max(60)).max(12).default([]),
});
export type NetworkingOptinInput = z.infer<typeof networkingOptinSchema>;

/** Slugify a title into a URL-safe slug. The route ensures uniqueness. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "event";
}
