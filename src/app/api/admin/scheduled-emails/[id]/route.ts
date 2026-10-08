/**
 * One scheduled email (the signed in person's own).
 *   PATCH { action: "cancel" }                  → canceled (only while still scheduled or failed)
 *   PATCH { action: "reschedule", sendAt }      → new send time (scheduled or failed → scheduled)
 *   PATCH { action: "send_now" | "retry" }      → sends it at once through its own send route
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { db, validSendAt } from "@/lib/scheduled-emails/schedule";
import { sendScheduledEmailNow } from "@/lib/scheduled-emails/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("reschedule"), sendAt: z.string().max(40) }),
  z.object({ action: z.literal("send_now") }),
  z.object({ action: z.literal("retry") }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { data: row } = await db().from("scheduled_emails").select("id, created_by, status").eq("id", id).maybeSingle();
  const r = row as { id: string; created_by: string; status: string } | null;
  if (!r || r.created_by !== auth.profile.id) return NextResponse.json({ error: "Scheduled email not found." }, { status: 404 });
  const now = new Date().toISOString();

  if (parsed.data.action === "cancel") {
    const { data } = await db().from("scheduled_emails").update({ status: "canceled", updated_at: now }).eq("id", id).in("status", ["scheduled", "failed"]).select("id").maybeSingle();
    if (!data) return NextResponse.json({ error: "It's already sending or sent, so it can't be canceled." }, { status: 409 });
    return NextResponse.json({ ok: true });
  }
  if (parsed.data.action === "reschedule") {
    const invalid = validSendAt(parsed.data.sendAt);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    const sendAt = new Date(parsed.data.sendAt).toISOString();
    const { data } = await db().from("scheduled_emails").update({ status: "scheduled", send_at: sendAt, error: null, updated_at: now }).eq("id", id).in("status", ["scheduled", "failed"]).select("id").maybeSingle();
    if (!data) return NextResponse.json({ error: "It's already sending or sent, so the time can't change." }, { status: 409 });
    return NextResponse.json({ ok: true, sendAt });
  }
  const result = await sendScheduledEmailNow(id);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error ?? "Send failed." }, { status: 502 });
}
