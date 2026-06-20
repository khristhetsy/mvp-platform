import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";

// calendar_events isn't in the generated types — raw client.
function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

/** Look this far ahead for upcoming meetings to remind about. */
const LOOKAHEAD_MS = 30 * 60 * 1000;

type DueEvent = {
  id: string;
  owner_id: string;
  title: string;
  start_time: string;
  timezone: string;
  location: string | null;
  meet_url: string | null;
  attendees: Array<{ email: string; name?: string }> | null;
};

function formatWhen(startTime: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(startTime));
  } catch {
    return new Date(startTime).toUTCString();
  }
}

/**
 * Send reminder emails for confirmed, timed meetings starting within the next
 * 30 minutes that haven't been reminded yet, then stamp reminder_sent_at so the
 * next cron pass skips them. Best-effort per event.
 */
export async function sendDueReminders(now: Date = new Date()): Promise<{ processed: number; reminded: number }> {
  const admin = createServiceRoleClient();
  const nowISO = now.toISOString();
  const windowEnd = new Date(now.getTime() + LOOKAHEAD_MS).toISOString();

  const { data } = await raw(admin)
    .from("calendar_events")
    .select("id, owner_id, title, start_time, timezone, location, meet_url, attendees")
    .eq("status", "confirmed")
    .eq("all_day", false)
    .is("reminder_sent_at", null)
    .gte("start_time", nowISO)
    .lte("start_time", windowEnd)
    .limit(200);

  const events = (data ?? []) as DueEvent[];
  if (events.length === 0) return { processed: 0, reminded: 0 };

  // Resolve owner emails in one query.
  const ownerIds = Array.from(new Set(events.map((e) => e.owner_id)));
  const { data: owners } = await admin.from("profiles").select("id, email, full_name").in("id", ownerIds);
  const ownerById = new Map(
    ((owners ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>).map((o) => [o.id, o]),
  );

  let reminded = 0;
  const done: string[] = [];

  for (const event of events) {
    const owner = ownerById.get(event.owner_id);
    const recipients = new Set<string>();
    if (owner?.email) recipients.add(owner.email);
    for (const a of event.attendees ?? []) if (a.email) recipients.add(a.email);

    if (recipients.size > 0) {
      const when = formatWhen(event.start_time, event.timezone);
      const meet = event.meet_url ? `<p>Join Google Meet: <a href="${event.meet_url}">${event.meet_url}</a></p>` : "";
      const loc = event.location ? `<p><strong>Location:</strong> ${event.location}</p>` : "";
      const ok = await sendEmail({
        to: Array.from(recipients),
        subject: `Reminder: ${event.title} at ${when}`,
        html: [
          `<p>This is a reminder for your upcoming meeting.</p>`,
          `<p><strong>${event.title}</strong></p>`,
          `<p><strong>When:</strong> ${when}</p>`,
          loc,
          meet,
        ].join(""),
      });
      if (ok) reminded += 1;
    }
    done.push(event.id);
  }

  // Stamp regardless of send success so we don't retry indefinitely.
  if (done.length > 0) {
    await raw(admin)
      .from("calendar_events")
      .update({ reminder_sent_at: nowISO })
      .in("id", done);
  }

  return { processed: events.length, reminded };
}
