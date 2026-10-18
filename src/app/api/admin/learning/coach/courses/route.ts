import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { isCoachReady } from "@/lib/learning/coach/admin";
import { isCoachTone } from "@/lib/learning/coach/tones";
import { currentReviewHash, reviewAllowsCoach, reviewState } from "@/lib/learning/coach/review-pack";

/**
 * PUT: switch the AI IR Coach on or off for one course. Staff only.
 * steps_ready is decided here from the course content, never from the request, so a course
 * without steps cannot be enabled (the table also refuses it).
 */
export async function PUT(request: Request) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as { courseKey?: unknown; enabled?: unknown; tone?: unknown };
  const courseKey = typeof body.courseKey === "string" ? body.courseKey.trim() : "";
  if (!courseKey || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "courseKey and enabled are required." }, { status: 400 });
  }
  if (body.tone !== undefined && body.tone !== null && !isCoachTone(body.tone)) {
    return NextResponse.json({ error: "Unknown coaching style." }, { status: 400 });
  }

  const ready = isCoachReady(courseKey);
  if (body.enabled && !ready) {
    return NextResponse.json({ error: "This course has no coach steps yet, so the coach cannot be enabled." }, { status: 409 });
  }

  const client = auth.supabase as unknown as SupabaseClient;
  if (body.enabled) {
    const { data: cfg } = await client.from("course_coach_config").select("reviewed_hash").eq("course_key", courseKey).maybeSingle();
    const state = reviewState({ currentHash: currentReviewHash(courseKey), reviewedHash: (cfg as { reviewed_hash: string | null } | null)?.reviewed_hash });
    if (!reviewAllowsCoach(state)) {
      return NextResponse.json(
        { error: state === "changed" ? "The wording changed since counsel reviewed it. Counsel must review the new wording first." : "Counsel has not reviewed this wording yet." },
        { status: 409 },
      );
    }
  }
  const { error } = await client.from("course_coach_config").upsert(
    {
      course_key: courseKey,
      enabled: body.enabled,
      steps_ready: ready,
      tone: isCoachTone(body.tone) ? body.tone : null,
      updated_by: auth.profile.id,
    },
    { onConflict: "course_key" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, courseKey, enabled: body.enabled });
}
