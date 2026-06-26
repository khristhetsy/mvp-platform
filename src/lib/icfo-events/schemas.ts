import { z } from "zod";
import { isValidSectorSlug } from "./sectors";

const sectorSlug = z.string().refine(isValidSectorSlug, { message: "Unknown sector" });

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
  sectors: z.array(sectorTrackInput).max(8).default([]),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  summary: z.string().max(2000).nullable().optional(),
  format: z.enum(["showcase", "demo_day", "webinar", "hybrid"]).optional(),
  visibility: z.enum(["public", "members"]).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  sectors: z.array(sectorTrackInput).max(8).optional(),
});
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const publishEventSchema = z.object({
  action: z.enum(["publish", "unpublish", "archive"]),
});
export type PublishEventInput = z.infer<typeof publishEventSchema>;

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
