import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { isCoachReady } from "@/lib/learning/coach/admin";
import { currentReviewHash } from "@/lib/learning/coach/review-pack";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST: record that counsel reviewed a coach course's current wording. Admin only.
 * The fingerprint is computed here from the live wording. The browser never supplies it, so a review
 * can only ever vouch for what is actually live. The record is append only.
 */
export async function POST(request: Request) {
  const auth = await requireApiProfile(["admin"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as { courseKey?: unknown; reviewerName?: unknown; reference?: unknown; reviewedOn?: unknown };
  const courseKey = typeof body.courseKey === "string" ? body.courseKey.trim() : "";
  const reviewerName = typeof body.reviewerName === "string" ? body.reviewerName.trim().slice(0, 200) : "";
  const reference = typeof body.reference === "string" ? body.reference.trim().slice(0, 300) : "";
  const reviewedOn = typeof body.reviewedOn === "string" ? body.reviewedOn : "";

  const hash = currentReviewHash(courseKey);
  if (!hash) return NextResponse.json({ error: "This course is not in the coach format." }, { status: 404 });
  if (!reviewerName) return NextResponse.json({ error: "Enter the name of the counsel who reviewed it." }, { status: 400 });
  const today = new Date().toISOString().slice(0, 10);
  if (!DATE.test(reviewedOn) || Number.isNaN(Date.parse(reviewedOn)) || reviewedOn > today) {
    return NextResponse.json({ error: "Enter the review date. It cannot be in the future." }, { status: 400 });
  }

  const client = auth.supabase as unknown as SupabaseClient;
  const { error: insertError } = await client.from("coach_counsel_reviews").insert({
    course_key: courseKey,
    content_hash: hash,
    reviewer_name: reviewerName,
    reference: reference || null,
    reviewed_on: reviewedOn,
    recorded_by: auth.profile.id,
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Only the fingerprint goes on the course config. Enabling is a separate, deliberate switch.
  const { error } = await client.from("course_coach_config").upsert(
    { course_key: courseKey, reviewed_hash: hash, steps_ready: isCoachReady(courseKey), updated_by: auth.profile.id },
    { onConflict: "course_key" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, courseKey });
}
