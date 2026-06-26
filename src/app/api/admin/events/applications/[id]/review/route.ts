import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { upsertReview, listReviews, summarize } from "@/lib/icfo-events/reviews";

export const dynamic = "force-dynamic";

const reviewSchema = z.object({
  recommendation: z.enum(["approve", "decline", "abstain"]),
  rubricScores: z.record(z.string(), z.number().min(0).max(5)).default({}),
  note: z.string().max(2000).nullable().optional(),
});

/** List the panel's reviews + summary for an application (staff). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const reviews = await listReviews(auth.supabase, id);
    return NextResponse.json({ reviews, summary: summarize(reviews), myReviewerId: auth.profile.id });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load reviews." }, { status: 500 });
  }
}

/** Submit/update the current reviewer's review (staff). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const parsed = reviewSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    await upsertReview(auth.supabase, id, auth.profile.id, {
      rubricScores: parsed.data.rubricScores,
      recommendation: parsed.data.recommendation,
      note: parsed.data.note ?? null,
    });
    const reviews = await listReviews(auth.supabase, id);
    return NextResponse.json({ reviews, summary: summarize(reviews) }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to save review." }, { status: 500 });
  }
}
