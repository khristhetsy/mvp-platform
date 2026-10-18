import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { getCoachAccess } from "@/lib/learning/coach/access";
import { getCoachLesson } from "@/lib/learning/coach/courses";
import { DEFAULT_COACH_TONE, isCoachTone } from "@/lib/learning/coach/tones";

const loose = (c: unknown) => c as SupabaseClient;

/** GET: the founder's coach state for a course and lesson, plus the lesson's steps and which are done. */
export async function GET(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const courseSlug = url.searchParams.get("courseSlug")?.trim() ?? "";
  const lessonSlug = url.searchParams.get("lessonSlug")?.trim() ?? "";
  if (!courseSlug) return NextResponse.json({ error: "courseSlug is required." }, { status: 400 });

  const { company } = await getActiveCompanyForUser(auth.profile);
  const client = loose(auth.supabase);
  const access = await getCoachAccess(client, {
    founderId: auth.profile.id,
    companyId: company?.id ?? null,
    courseSlug,
  });

  const found = lessonSlug ? getCoachLesson(courseSlug, lessonSlug) : null;
  let doneIndexes: number[] = [];
  if (access.active && found && company) {
    const { data } = await client
      .from("coach_step_events")
      .select("step_index")
      .eq("founder_id", auth.profile.id)
      .eq("company_id", company.id)
      .eq("course_slug", courseSlug)
      .eq("lesson_id", lessonSlug)
      .eq("event", "done");
    doneIndexes = [...new Set(((data ?? []) as Array<{ step_index: number }>).map((r) => r.step_index))].sort((a, b) => a - b);
  }

  return NextResponse.json({
    active: access.active,
    courseEnabled: access.courseEnabled,
    enrollment: access.enrollment,
    tone: access.tone,
    steps: access.active && found ? found.steps : [],
    doneIndexes,
  });
}

/** PUT: the founder opts in, pauses, resumes, ends, or changes style. Only their own enrollment. */
export async function PUT(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as { action?: unknown; tone?: unknown };
  const action = typeof body.action === "string" ? body.action : "";
  if (!["opt_in", "pause", "resume", "end", "set_tone"].includes(action)) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  if (body.tone !== undefined && !isCoachTone(body.tone)) {
    return NextResponse.json({ error: "Unknown coaching style." }, { status: 400 });
  }

  const { company } = await getActiveCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "No active company." }, { status: 400 });
  const client = loose(auth.supabase);

  const { data: existing } = await client
    .from("coach_enrollments")
    .select("id, status, tone")
    .eq("founder_id", auth.profile.id)
    .eq("company_id", company.id)
    .maybeSingle();

  if (action === "opt_in") {
    if (existing) {
      const { error } = await client
        .from("coach_enrollments")
        .update({ status: "active", paused_at: null, ...(isCoachTone(body.tone) ? { tone: body.tone } : {}) })
        .eq("id", (existing as { id: string }).id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await client.from("coach_enrollments").insert({
        founder_id: auth.profile.id,
        company_id: company.id,
        source: "founder_opt_in",
        tone: isCoachTone(body.tone) ? body.tone : DEFAULT_COACH_TONE,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!existing) return NextResponse.json({ error: "You are not enrolled in coaching." }, { status: 404 });
  const id = (existing as { id: string }).id;

  const patch: Record<string, unknown> =
    action === "pause"
      ? { status: "paused", paused_at: new Date().toISOString() }
      : action === "resume"
        ? { status: "active", paused_at: null }
        : action === "end"
          ? { status: "ended" }
          : isCoachTone(body.tone)
            ? { tone: body.tone }
            : {};
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const { error } = await client.from("coach_enrollments").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
