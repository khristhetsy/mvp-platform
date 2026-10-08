import "server-only";

/**
 * Schedule send, the storing half. A send route that receives `scheduleAt`
 * (after its own sign in and validation checks pass) calls scheduleSend()
 * instead of sending: the request is stored as posted, minus scheduleAt, and
 * /api/cron/scheduled-emails replays it through the same route at that time
 * (see runner.ts). Staff only.
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { validSendAt } from "./time";

export { validSendAt };

export type ScheduledKind = "contracts" | "gmail_send" | "gmail_reply" | "ir_match_email" | "sales_chatter" | "mass_email";

export function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

/** The requested send time, or null when the request is a normal send now. */
export function scheduleAtFrom(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const v = (raw as { scheduleAt?: unknown }).scheduleAt;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** The request body without scheduleAt, as the route would receive it at send time. */
export function payloadWithoutSchedule(raw: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = { ...((raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>) };
  delete out.scheduleAt;
  return out;
}

async function isStaff(userId: string): Promise<boolean> {
  const { data } = await db().from("profiles").select("role").eq("id", userId).maybeSingle();
  const role = String((data as { role?: string } | null)?.role ?? "");
  return role === "admin" || role === "analyst";
}

export async function scheduleSend(input: {
  kind: ScheduledKind;
  userId: string;
  raw: unknown;
  params?: Record<string, string>;
  toLabel: string;
  subject: string;
  contextKey?: string | null;
}): Promise<Response> {
  const sendAt = scheduleAtFrom(input.raw) ?? "";
  const invalid = validSendAt(sendAt);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  if (!(await isStaff(input.userId))) return NextResponse.json({ error: "Scheduling is for staff only." }, { status: 403 });
  const { data, error } = await db()
    .from("scheduled_emails")
    .insert({
      created_by: input.userId,
      kind: input.kind,
      payload: payloadWithoutSchedule(input.raw),
      params: input.params ?? {},
      to_label: input.toLabel.slice(0, 500),
      subject: input.subject.slice(0, 300),
      context_key: input.contextKey ?? null,
      send_at: new Date(sendAt).toISOString(),
    })
    .select("id, send_at")
    .single();
  if (error || !data) {
    const missing = error?.message?.includes("scheduled_emails");
    return NextResponse.json({ error: missing ? "Scheduling isn't set up yet: run the scheduled_emails SQL in Supabase." : "Couldn't schedule the email. Try again." }, { status: 500 });
  }
  const row = data as { id: string; send_at: string };
  return NextResponse.json({ ok: true, scheduled: true, id: row.id, sendAt: row.send_at });
}
