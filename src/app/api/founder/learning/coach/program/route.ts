import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { getCoachAccess } from "@/lib/learning/coach/access";
import { getCoachLesson } from "@/lib/learning/coach/courses";
import { OUTREACH_PLAYBOOK_SLUG } from "@/lib/learning/outreach-playbook";
import { MONDAY_REVIEW_SLUG, getProgramModule } from "@/lib/learning/coach/program";
import { commitmentStreak, loadProgramRaw, metricValue, weekLine, whereYouStand } from "@/lib/learning/coach/program-reads";
import { pacificDate } from "@/lib/learning/coach/plan-items";
import { createTask } from "@/lib/tasks/db";
import { completeLesson } from "@/lib/learning/lesson-progress";
import { PROGRAM_EVENT_INDEX, dueChoiceFor, isProgramEventKind } from "@/lib/learning/coach/program-events";

const loose = (c: unknown) => c as SupabaseClient;

async function context() {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return { error: auth.error };
  const { company } = await getActiveCompanyForUser(auth.profile);
  const client = loose(auth.supabase);
  const access = await getCoachAccess(client, { founderId: auth.profile.id, companyId: company?.id ?? null, courseSlug: OUTREACH_PLAYBOOK_SLUG });
  if (!company || !access.active) {
    return { error: NextResponse.json({ error: "The coach is not active for you on this course." }, { status: 403 }) };
  }
  return { auth, company, client, access };
}

/** GET: everything the coached page needs for one lesson: live reads, where you stand, streak, commitments. */
export async function GET(request: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const lessonSlug = new URL(request.url).searchParams.get("lessonSlug")?.trim() || "game-plan";
  const mod = getProgramModule(lessonSlug);
  const raw = await loadProgramRaw({ profile: ctx.auth.profile, company: ctx.company });
  const streak = commitmentStreak(raw.commitments);
  return NextResponse.json({
    tone: ctx.access.tone,
    raw,
    stand: whereYouStand(raw),
    weekLine: weekLine(raw, mod ? lessonSlug : "game-plan"),
    streak,
    metric: mod ? metricValue(raw, mod.doMetric) : null,
    openCommitments: raw.commitments.filter((c) => c.status === "open"),
    lastResolved: [...raw.commitments].reverse().find((c) => c.status === "kept" || c.status === "missed") ?? null,
  });
}

/**
 * POST actions, every one the founder's own click:
 *   log          records a program event (opened, recall, answer, test) with a short note
 *   self_report  marks the lesson's steps done when the coach cannot read that screen
 *   commit       saves the if-then commitment, creates the dated task, marks the lesson complete
 */
export async function POST(request: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const { auth, company, client } = ctx;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  const lessonSlug = typeof body.lessonSlug === "string" ? body.lessonSlug.trim() : "";
  const isReview = lessonSlug === MONDAY_REVIEW_SLUG;
  const found = isReview ? null : getCoachLesson(OUTREACH_PLAYBOOK_SLUG, lessonSlug);
  if (!isReview && !found) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });

  const base = { founder_id: auth.profile.id, company_id: company.id, course_slug: OUTREACH_PLAYBOOK_SLUG, lesson_id: lessonSlug };

  if (action === "log") {
    if (!isProgramEventKind(body.kind)) return NextResponse.json({ error: "Unknown event." }, { status: 400 });
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : null;
    const { error } = await client.from("coach_step_events").insert({ ...base, step_index: PROGRAM_EVENT_INDEX[body.kind], event: body.kind, note });
    // Before the migration runs the check constraint rejects these kinds. The lesson goes on; nothing else depends on the row.
    return NextResponse.json({ ok: !error, logged: !error });
  }

  if (action === "self_report") {
    if (!found) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
    const rows = found.steps.map((_, i) => ({ ...base, step_index: i, event: "done", note: "Reported done in the coached program; this screen is not read by the coach." }));
    const { error } = await client.from("coach_step_events").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "commit") {
    const cue = typeof body.cue === "string" ? body.cue.trim().slice(0, 80) : "";
    const act = typeof body.act === "string" ? body.act.trim().slice(0, 140) : "";
    const dueAt = typeof body.dueAt === "string" ? new Date(body.dueAt) : null;
    if (!cue || !act) return NextResponse.json({ error: "Write both halves: if it is ..., then I will ..." }, { status: 400 });
    if (!dueAt || Number.isNaN(dueAt.getTime()) || dueAt.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ error: "Pick a date and time that is still ahead of you." }, { status: 400 });
    }
    const title = `If it is ${cue}, then I will ${act}`.slice(0, 200);
    const dueChoice = dueChoiceFor(dueAt);
    const stepIndex = found ? Math.max(0, found.steps.length - 1) : 0;

    const { data: commitment, error: cErr } = await client
      .from("coach_commitments")
      .insert({ ...base, step_index: stepIndex, title, due_choice: dueChoice, due_at: dueAt.toISOString() })
      .select("id")
      .single();
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

    // The founder pressed Save: that is the confirmation the task needs.
    let taskId: string | null = null;
    try {
      const task = await createTask(auth.profile.id, {
        title: `Playbook: ${act}`.slice(0, 500),
        description: `${title}. From ${found ? found.lesson.title : "the Monday review"}, Investor Outreach Playbook. Your coach checks this at the time you chose.`,
        priority: "medium",
        due_date: pacificDate(dueAt.toISOString()),
        context_type: "personal",
        task_type: "investor_outreach",
      });
      taskId = task.id;
      await client.from("coach_commitments").update({ task_ref: task.id }).eq("id", (commitment as { id: string }).id);
    } catch {
      // The commitment is saved either way; the page says the task could not be added.
    }

    if (found) {
      const rows = found.steps.map((_, i) => ({ ...base, step_index: i, event: "done", note: "Completed in the coached program." }));
      await client.from("coach_step_events").insert(rows);
      await client.from("coach_step_events").insert({ ...base, step_index: PROGRAM_EVENT_INDEX.commit, event: "commit", note: title });
      await completeLesson({ founderId: auth.profile.id, companyId: company.id, moduleSlug: OUTREACH_PLAYBOOK_SLUG, lessonId: lessonSlug }).catch(() => undefined);
    }
    return NextResponse.json({ ok: true, taskId, dueAt: dueAt.toISOString(), dueChoice });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
