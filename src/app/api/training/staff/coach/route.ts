import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { getEnrollment } from "@/lib/learning/staff-training/data";
import { getTrainingModule } from "@/lib/learning/staff-training/catalog";
import { buildAskPrompt, coachReply } from "@/lib/learning/staff-training/coach";

/** Ask the coach. The reply is advice only; nothing is written. */
export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;
  const enr = await getEnrollment(auth.profile.id);
  if (!enr) return NextResponse.json({ error: "No training access." }, { status: 403 });
  if (!enr.coach_on) return NextResponse.json({ error: "The coach is off for this course." }, { status: 409 });
  const b = (await request.json().catch(() => ({}))) as { moduleKey?: unknown; question?: unknown };
  const mod = typeof b.moduleKey === "string" ? getTrainingModule(b.moduleKey) : null;
  const q = typeof b.question === "string" ? b.question.trim() : "";
  if (!mod?.steps || !q) return NextResponse.json({ error: "A lesson and a question are required." }, { status: 400 });
  const p = buildAskPrompt({ module: mod, tone: enr.coach_tone }, q);
  const reply = await coachReply(p.system, p.user);
  return NextResponse.json({ reply: reply ?? "The coach is not available right now. Ask your reviewer, or try again later." });
}
