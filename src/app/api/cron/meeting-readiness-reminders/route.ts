import { NextResponse } from "next/server";
import { getCronSecret, validateCronSecret, cronMisconfiguredResponse, cronUnauthorizedResponse } from "@/lib/notifications/cron/auth";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

/** Pacific-time YYYY-MM-DD offset from today. */
function ptDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(d); // YYYY-MM-DD
}

/**
 * Readiness reminders: for sessions happening today (T-4h window) or tomorrow (T-24h),
 * email the default presenter of every required section that isn't 'ready'. Idempotent
 * per (session, section, threshold). Step-1 uses date windows; can be tightened to exact
 * hours once meeting start-times are wired.
 */
async function run(): Promise<{ sent: number }> {
  const windows: Array<{ date: string; threshold: string }> = [
    { date: ptDate(1), threshold: "t-24h" },
    { date: ptDate(0), threshold: "t-4h" },
  ];
  let sent = 0;

  for (const w of windows) {
    const { data: sessions } = await db().from("ceo_meeting_sessions").select("id, meeting_key").eq("session_date", w.date);
    for (const s of (sessions ?? []) as Array<{ id: string; meeting_key: string }>) {
      const { data: rows } = await db().from("ceo_meeting_section_entries")
        .select("section_id, status, section:ceo_meeting_sections(title, is_required, default_presenter_id)")
        .eq("session_id", s.id);
      for (const r of (rows ?? []) as Array<{ section_id: string; status: string; section: { title: string; is_required: boolean; default_presenter_id: string | null } | null }>) {
        const sec = r.section;
        if (!sec || !sec.is_required || r.status === "ready" || r.status === "presented" || !sec.default_presenter_id) continue;

        // Idempotency: skip if already reminded at this threshold.
        const { data: existing } = await db().from("ceo_meeting_reminder_log")
          .select("id").eq("session_id", s.id).eq("section_id", r.section_id).eq("threshold", w.threshold).maybeSingle();
        if (existing) continue;

        const { data: person } = await db().from("profiles").select("email, full_name").eq("id", sec.default_presenter_id).maybeSingle();
        if (person?.email) {
          const ok = await sendEmail({
            to: person.email,
            subject: `Meeting prep reminder — ${sec.title}`,
            html: `<p>Hi ${person.full_name ? String(person.full_name).split(" ")[0] : "there"},</p><p>Your section <strong>${sec.title}</strong> for the ${w.date} management meeting isn't marked ready yet. Please finish your prep in iCapOS.</p><p>iCapOS — Powered by iCFO Capital Global, Inc.</p>`,
            text: `Reminder: your section "${sec.title}" for the ${w.date} management meeting isn't ready yet.`,
          }).catch(() => false);
          if (ok) sent++;
        }
        await db().from("ceo_meeting_reminder_log").insert({ session_id: s.id, section_id: r.section_id, threshold: w.threshold });
      }
    }
  }
  return { sent };
}

export async function GET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();
  return NextResponse.json(await run());
}

export async function POST(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return NextResponse.json(await run());
}
