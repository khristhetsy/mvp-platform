import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  getCompanyGateReminders,
  sendGateReminderNow,
  setGateReminderPaused,
  setGateReminderSchedule,
  gateEmailPreview,
} from "@/lib/notifications/stage-gate-reminders";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): SupabaseClient<any> { return createServiceRoleClient() as unknown as SupabaseClient<any>; }

async function founderIdFor(companyId: string): Promise<string | null> {
  const { data } = await db().from("companies").select("founder_id").eq("id", companyId).maybeSingle();
  return (data as { founder_id?: string | null } | null)?.founder_id ?? null;
}

// GET — per-gate reminder statuses for this company (Founder Progress pills + detail).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ companyId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const { companyId } = await params;
  const founderId = await founderIdFor(companyId);
  const gates = await getCompanyGateReminders(companyId, founderId);
  return NextResponse.json({ gates });
}

// POST { gateKey, action: "send-now" | "pause" | "resume" } — per-gate controls.
export async function POST(req: NextRequest, { params }: { params: Promise<{ companyId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const gateKey = String((body as { gateKey?: unknown }).gateKey ?? "");
  const action = String((body as { action?: unknown }).action ?? "");
  const preview = gateEmailPreview(gateKey);
  if (!preview) return NextResponse.json({ error: "Unknown gate." }, { status: 400 });
  const founderId = await founderIdFor(companyId);

  if (action === "send-now") {
    const r = await sendGateReminderNow(companyId, founderId, gateKey);
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  if (action === "pause" || action === "resume") {
    await setGateReminderPaused(companyId, founderId, gateKey, action === "pause");
    return NextResponse.json({ ok: true });
  }
  if (action === "schedule") {
    const sendAt = String((body as { sendAt?: unknown }).sendAt ?? "");
    const recurring = Boolean((body as { recurring?: unknown }).recurring);
    const r = await setGateReminderSchedule(companyId, founderId, gateKey, sendAt, recurring);
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
