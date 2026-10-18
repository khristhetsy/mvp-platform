import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { getCoachAccess } from "@/lib/learning/coach/access";
import { getCoachLesson } from "@/lib/learning/coach/courses";
import { dueAtFor, isDueChoice, isStepEventKind, stepEventReply } from "@/lib/learning/coach/ir-coach";

const loose = (c: unknown) => c as SupabaseClient;

/**
 * POST: a step check in (I did it, I am stuck, Not now). Deterministic, no AI call.
 * "Not now" with a chosen time records a commitment. That click is the founder's confirmation.
 * Nothing is written to Tasks or Calendar here; the step card does that when the founder presses a button.
 */
export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const courseSlug = typeof body.courseSlug === "string" ? body.courseSlug.trim() : "";
  const lessonSlug = typeof body.lessonSlug === "string" ? body.lessonSlug.trim() : "";
  const stepIndex = typeof body.stepIndex === "number" && Number.isInteger(body.stepIndex) ? body.stepIndex : -1;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";

  if (!isStepEventKind(body.event)) return NextResponse.json({ error: "Unknown event." }, { status: 400 });
  const found = getCoachLesson(courseSlug, lessonSlug);
  if (!found || stepIndex < 0 || stepIndex >= found.steps.length) {
    return NextResponse.json({ error: "Step not found." }, { status: 404 });
  }
  if (body.event === "skipped" && !isDueChoice(body.dueChoice)) {
    return NextResponse.json({ error: "Choose when you will do it: today, tomorrow or this week." }, { status: 400 });
  }

  const { company } = await getActiveCompanyForUser(auth.profile);
  const client = loose(auth.supabase);
  const access = await getCoachAccess(client, {
    founderId: auth.profile.id,
    companyId: company?.id ?? null,
    courseSlug,
  });
  if (!company || !access.active) {
    return NextResponse.json({ error: "The coach is not active for you on this course." }, { status: 403 });
  }

  const step = found.steps[stepIndex];
  const { error: eventError } = await client.from("coach_step_events").insert({
    founder_id: auth.profile.id,
    company_id: company.id,
    course_slug: courseSlug,
    lesson_id: lessonSlug,
    step_index: stepIndex,
    event: body.event,
    note: note || null,
  });
  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });

  let dueAt: string | null = null;
  if (body.event === "skipped" && isDueChoice(body.dueChoice)) {
    const when = dueAtFor(body.dueChoice);
    dueAt = when.toISOString();
    const { error } = await client.from("coach_commitments").insert({
      founder_id: auth.profile.id,
      company_id: company.id,
      course_slug: courseSlug,
      lesson_id: lessonSlug,
      step_index: stepIndex,
      title: step.title.slice(0, 200),
      due_choice: body.dueChoice,
      due_at: dueAt,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reply = stepEventReply({
    tone: access.tone,
    event: body.event,
    step,
    nextStep: found.steps[stepIndex + 1] ?? null,
  });

  return NextResponse.json({
    reply,
    nextStepIndex: body.event === "done" && stepIndex + 1 < found.steps.length ? stepIndex + 1 : stepIndex,
    dueAt,
  });
}
