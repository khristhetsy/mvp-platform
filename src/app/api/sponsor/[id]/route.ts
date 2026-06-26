import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requireUserProfile } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOwnedSponsor, updateSponsorBooth } from "@/lib/icfo-events/sponsors";

export const dynamic = "force-dynamic";

const schema = z.object({
  blurb: z.string().max(1000).nullable().optional(),
  website: z.string().url().nullable().optional(),
  downloads: z
    .array(z.object({ label: z.string().min(1).max(80), url: z.string().url() }))
    .max(8)
    .optional(),
});

/** Sponsor owner edits their own booth fields. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const profile = await requireUserProfile();
  try {
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const owned = await getOwnedSponsor(supabase, id, profile.id);
    if (!owned) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const sponsor = await updateSponsorBooth(supabase, id, parsed.data);
    return NextResponse.json({ sponsor });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to update booth." }, { status: 500 });
  }
}
