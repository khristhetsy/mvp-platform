import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { sponsorBoothSchema } from "@/lib/icfo-events/schemas";
import { isValidSectorSlug } from "@/lib/icfo-events/sectors";
import {
  updateSponsorBooth,
  updateSponsorDetails,
  setSponsorArchived,
  deleteSponsor,
  countSponsorEventLinks,
  getSponsorById,
} from "@/lib/icfo-events/sponsors";
import type { Sponsor } from "@/lib/icfo-events/types";

export const dynamic = "force-dynamic";

// Booth fields (video/contact/meeting) + core catalog fields + archive flag.
const patchSchema = sponsorBoothSchema.extend({
  name: z.string().min(1).max(160).optional(),
  tier: z.enum(["presenting", "gold", "silver", "community"]).optional(),
  category: z.enum(["legal", "consulting", "banking", "other"]).optional(),
  sectorSlug: z.string().refine(isValidSectorSlug, "Unknown sector").nullable().optional().or(z.literal("")),
  categoryExclusive: z.boolean().optional(),
  archived: z.boolean().optional(),
});

/** Staff edits a sponsor: core fields, booth fields, and/or archive state. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const d = parsed.data;
    let sponsor: Sponsor | null = null;

    // Archive / restore.
    if (d.archived !== undefined) {
      sponsor = await setSponsorArchived(auth.supabase, id, d.archived);
    }

    // Core catalog edits.
    if (d.name !== undefined || d.tier !== undefined || d.category !== undefined || d.sectorSlug !== undefined || d.categoryExclusive !== undefined || d.blurb !== undefined || d.website !== undefined) {
      sponsor = await updateSponsorDetails(auth.supabase, id, {
        name: d.name,
        website: d.website === "" ? null : d.website,
        blurb: d.blurb,
        tier: d.tier,
        category: d.category,
        sectorSlug: d.sectorSlug === "" ? null : d.sectorSlug,
        categoryExclusive: d.categoryExclusive,
      });
    }

    // Booth fields (video / contact / meeting) — only when at least one is present.
    if (d.videoProvider !== undefined || d.videoRef !== undefined || d.allowContactRequest !== undefined || d.meetingUrl !== undefined) {
      sponsor = await updateSponsorBooth(auth.supabase, id, {
        videoProvider: d.videoProvider,
        videoRef: d.videoRef,
        allowContactRequest: d.allowContactRequest,
        meetingUrl: d.meetingUrl === "" ? null : d.meetingUrl,
      });
    }

    if (!sponsor) sponsor = await getSponsorById(auth.supabase, id);
    return NextResponse.json({ sponsor });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to update sponsor." }, { status: 500 });
  }
}

/** Hard-delete a sponsor — blocked while it's attached to any events (archive instead). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const links = await countSponsorEventLinks(auth.supabase, id);
    if (links > 0) {
      return NextResponse.json(
        { error: `This sponsor is attached to ${links} event${links === 1 ? "" : "s"}. Detach it or archive instead.` },
        { status: 409 },
      );
    }
    await deleteSponsor(auth.supabase, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to delete sponsor." }, { status: 500 });
  }
}
