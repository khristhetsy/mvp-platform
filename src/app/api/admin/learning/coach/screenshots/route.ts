import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { approvalPatch, type ScreenshotRow } from "@/lib/learning/coach/screenshots";

const ACTIONS = ["approve", "flag", "unflag", "request_capture"] as const;
type Action = (typeof ACTIONS)[number];
const MAX_REQUEST = 200;

/**
 * PUT: staff review of a course screenshot. approve publishes the latest capture to founders, flag and
 * unflag mark a step as needing a fix, request_capture asks the next capture run to redo steps.
 * Runs under the staff member's own session, so row level security applies. Staff only.
 */
export async function PUT(request: Request) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as { action?: unknown; stepKey?: unknown; stepKeys?: unknown; note?: unknown };
  const action = ACTIONS.find((a) => a === body.action) as Action | undefined;
  if (!action) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  const client = auth.supabase as unknown as SupabaseClient;
  const now = new Date();

  if (action === "request_capture") {
    const keys = Array.isArray(body.stepKeys)
      ? body.stepKeys.filter((k): k is string => typeof k === "string")
      : typeof body.stepKey === "string"
        ? [body.stepKey]
        : [];
    if (keys.length === 0) return NextResponse.json({ error: "Choose at least one step." }, { status: 400 });
    if (keys.length > MAX_REQUEST) return NextResponse.json({ error: "Too many steps in one request." }, { status: 400 });
    const { error } = await client.from("coach_screenshots").update({ capture_requested_at: now.toISOString() }).in("step_key", keys);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, requested: keys.length });
  }

  const stepKey = typeof body.stepKey === "string" ? body.stepKey : "";
  if (!stepKey) return NextResponse.json({ error: "stepKey is required." }, { status: 400 });

  const { data, error: readError } = await client.from("coach_screenshots").select("*").eq("step_key", stepKey).maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Step not found." }, { status: 404 });
  const row = data as ScreenshotRow;

  let patch: Record<string, unknown> | null;
  if (action === "approve") {
    patch = approvalPatch(row, auth.profile.id, now);
    if (!patch) return NextResponse.json({ error: "There is no clean capture to approve yet." }, { status: 409 });
  } else if (action === "flag") {
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
    patch = { needs_fix: true, needs_fix_note: note || null };
  } else {
    patch = { needs_fix: false, needs_fix_note: null };
  }

  const { error } = await client.from("coach_screenshots").update(patch).eq("step_key", stepKey);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
