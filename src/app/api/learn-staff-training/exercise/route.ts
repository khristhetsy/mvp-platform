import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { getEnrollment, service } from "@/lib/learning/staff-training/data";
import { getTrainingModule } from "@/lib/learning/staff-training/catalog";
import { buildFeedbackPrompt, coachReply } from "@/lib/learning/staff-training/coach";

/** Submit an exercise answer. AI gives a first pass; a human reviewer sets Pass or Redo. */
export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;
  const enr = await getEnrollment(auth.profile.id);
  if (!enr) return NextResponse.json({ error: "No training access." }, { status: 403 });
  const b = (await request.json().catch(() => ({}))) as { moduleKey?: unknown; exerciseIndex?: unknown; answer?: unknown };
  const mod = typeof b.moduleKey === "string" ? getTrainingModule(b.moduleKey) : null;
  const idx = typeof b.exerciseIndex === "number" ? b.exerciseIndex : -1;
  const answer = typeof b.answer === "string" ? b.answer.trim() : "";
  const ex = mod?.exercises?.[idx];
  if (!mod || !ex || !answer) return NextResponse.json({ error: "An exercise and an answer are required." }, { status: 400 });

  let feedback: string | null = null;
  if (enr.coach_on) {
    const p = buildFeedbackPrompt({ module: mod, tone: enr.coach_tone }, ex, answer);
    feedback = await coachReply(p.system, p.user);
  }
  const { error } = await service().from("staff_training_exercises").insert({
    user_id: auth.profile.id, module_key: mod.key, exercise_index: idx, answer: answer.slice(0, 8000), ai_feedback: feedback, status: "submitted",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, feedback });
}
