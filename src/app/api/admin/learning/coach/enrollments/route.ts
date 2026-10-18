import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { planEnrollment, type FounderForEnrollment } from "@/lib/learning/coach/admin";
import { DEFAULT_COACH_TONE, isCoachTone } from "@/lib/learning/coach/tones";

const MAX_ALL = 1000;

/**
 * POST: enroll founders in the AI IR Coach. mode "selected" takes founderIds, mode "all" takes every
 * founder with a company except internal accounts. Staff only. Writes run under the staff member's
 * own session, so row level security applies.
 */
export async function POST(request: Request) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as { mode?: unknown; founderIds?: unknown; tone?: unknown };
  if (body.mode !== "selected" && body.mode !== "all") {
    return NextResponse.json({ error: "mode must be selected or all." }, { status: 400 });
  }
  const selectedIds = Array.isArray(body.founderIds) ? body.founderIds.filter((x): x is string => typeof x === "string") : [];
  if (body.mode === "selected" && selectedIds.length === 0) {
    return NextResponse.json({ error: "Choose at least one founder." }, { status: 400 });
  }
  if (body.tone !== undefined && !isCoachTone(body.tone)) {
    return NextResponse.json({ error: "Unknown coaching style." }, { status: 400 });
  }
  const tone = isCoachTone(body.tone) ? body.tone : DEFAULT_COACH_TONE;

  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  let q = admin.from("profiles").select("id, email, role").eq("role", "founder").limit(MAX_ALL);
  if (body.mode === "selected") q = q.in("id", selectedIds);
  const { data: profs, error: pErr } = await q;
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  const profiles = (profs ?? []) as Array<{ id: string; email: string | null; role: string | null }>;
  const ids = profiles.map((p) => p.id);

  const [{ data: comps }, { data: enr }] = await Promise.all([
    ids.length ? admin.from("companies").select("id, founder_id").in("founder_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? admin.from("coach_enrollments").select("founder_id, status").in("founder_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const companyByFounder = new Map<string, string>();
  for (const c of (comps ?? []) as Array<{ id: string; founder_id: string | null }>) {
    if (c.founder_id && !companyByFounder.has(c.founder_id)) companyByFounder.set(c.founder_id, c.id);
  }
  const activeFounderIds = new Set(
    ((enr ?? []) as Array<{ founder_id: string; status: string }>).filter((e) => e.status === "active").map((e) => e.founder_id),
  );

  const founders: FounderForEnrollment[] = profiles.map((p) => ({ id: p.id, email: p.email, role: p.role, companyId: companyByFounder.get(p.id) ?? null }));
  const plan = planEnrollment({ mode: body.mode, founders, selectedIds, activeFounderIds });

  const source = body.mode === "all" ? "admin_all" : "admin_selected";
  const client = auth.supabase as unknown as SupabaseClient;
  if (plan.enroll.length > 0) {
    const { error } = await client.from("coach_enrollments").upsert(
      plan.enroll.map((e) => ({
        founder_id: e.founderId,
        company_id: e.companyId,
        status: "active",
        paused_at: null,
        tone,
        source,
        enrolled_by: auth.profile.id,
      })),
      { onConflict: "founder_id,company_id" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, enrolled: plan.enroll.length, skipped: plan.skipped });
}

/** PATCH: pause, resume, end or change the style of one founder's enrollment. Staff only. */
export async function PATCH(request: Request) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as { founderId?: unknown; companyId?: unknown; action?: unknown; tone?: unknown };
  if (typeof body.founderId !== "string" || typeof body.companyId !== "string") {
    return NextResponse.json({ error: "founderId and companyId are required." }, { status: 400 });
  }
  const patch: Record<string, unknown> | null =
    body.action === "pause"
      ? { status: "paused", paused_at: new Date().toISOString() }
      : body.action === "resume"
        ? { status: "active", paused_at: null }
        : body.action === "end"
          ? { status: "ended" }
          : body.action === "set_tone" && isCoachTone(body.tone)
            ? { tone: body.tone }
            : null;
  if (!patch) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  const client = auth.supabase as unknown as SupabaseClient;
  const { error } = await client.from("coach_enrollments").update(patch).eq("founder_id", body.founderId).eq("company_id", body.companyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
