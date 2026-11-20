import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { getEnrollment, service } from "@/lib/learning/staff-training/data";
import { getTrainingModule } from "@/lib/learning/staff-training/catalog";

export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;
  if (!(await getEnrollment(auth.profile.id))) return NextResponse.json({ error: "No training access." }, { status: 403 });
  const b = (await request.json().catch(() => ({}))) as { moduleKey?: unknown; stepIndex?: unknown; done?: unknown };
  const mod = typeof b.moduleKey === "string" ? getTrainingModule(b.moduleKey) : null;
  const idx = typeof b.stepIndex === "number" ? b.stepIndex : -1;
  if (!mod?.steps || idx < 0 || idx >= mod.steps.length) return NextResponse.json({ error: "Unknown step." }, { status: 400 });
  const { error } = await service().from("staff_training_progress").upsert(
    { user_id: auth.profile.id, module_key: mod.key, step_index: idx, done: b.done !== false, updated_at: new Date().toISOString() },
    { onConflict: "user_id,module_key,step_index" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
