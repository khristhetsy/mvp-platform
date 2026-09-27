import { NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import { getCronSecret, validateCronSecret, cronMisconfiguredResponse, cronUnauthorizedResponse } from "@/lib/notifications/cron/auth";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { renderEmail } from "@/lib/email/layout";

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
          const first = person.full_name ? String(person.full_name).split(" ")[0] : null;
          const mail = renderEmail({
            audience: "admin",
            subject: `Your section for the ${w.date} team meeting isn't ready yet`,
            preheader: `${sec.title}. Mark it ready in iCapOS.`,
            context: `Team meeting · ${w.date}`,
            eyebrow: "Meeting prep",
            headline: `Finish your section: ${sec.title}`,
            intro: `${first ? `Hi ${first}, y` : "Y"}our section for the ${w.date} team meeting isn't marked ready yet.`,
            blocks: [{ type: "facts", rows: [{ label: "Meeting date", value: w.date }, { label: "Your section", value: sec.title }, { label: "Status", value: "Not ready" }] }],
            primary: { label: "Finish my prep", url: "/admin/ceo" },
            footer: { reason: "Internal. Sent to section owners before each team meeting." },
          });
          const ok = await sendEmail({ to: person.email, subject: mail.subject, html: mail.html, text: mail.text, fromName: "iCapOS Ops" }).catch(() => false);
          if (ok) sent++;
        }
        await db().from("ceo_meeting_reminder_log").insert({ session_id: s.id, section_id: r.section_id, threshold: w.threshold });
      }
    }
  }
  return { sent };
}

async function scheduledGET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();
  return NextResponse.json(await run());
}

export async function POST(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return NextResponse.json(await run());
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/meeting-readiness-reminders", scheduledGET);
