import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";

// calendar_events isn't in the generated types — raw client.
function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

const HOUR_MS = 60 * 60 * 1000;

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

async function sendTier(
  admin: SupabaseClient,
  tier: "24h" | "1h",
  now: Date,
): Promise<{ processed: number; reminded: number }> {
  const nowISO = now.toISOString();
  const stampCol = tier === "24h" ? "reminder_24h_sent_at" : "reminder_1h_sent_at";
  // 1h tier: events starting within the next hour. 24h tier: within the next 24h but
  // more than an hour away (so events under an hour get only the 1h reminder).
  const windowEnd = new Date(now.getTime() + (tier === "24h" ? 24 * HOUR_MS : HOUR_MS)).toISOString();
  const windowStart = tier === "24h" ? new Date(now.getTime() + HOUR_MS).toISOString() : nowISO;

  const { data } = await raw(admin)
    .from("calendar_events")
    .select("id, owner_id, title, start_time, timezone, location, meet_url, attendees")
    .eq("status", "confirmed").eq("all_day", false)
    .is(stampCol, null)
    .gte("start_time", windowStart).lte("start_time", windowEnd)
    .limit(200);
  const events = (data ?? []) as DueEvent[];
  if (events.length === 0) return { processed: 0, reminded: 0 };

  const ownerIds = Array.from(new Set(events.map((e) => e.owner_id)));
  const { data: owners } = await admin.from("profiles").select("id, email, full_name").in("id", ownerIds);
  const ownerById = new Map(((owners ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>).map((o) => [o.id, o]));

  const lead = tier === "24h" ? "tomorrow" : "in about an hour";
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
        subject: `Reminder: ${event.title} — ${tier === "24h" ? "tomorrow" : when}`,
        html: [
          `<p>This is a reminder for your upcoming meeting ${lead}.</p>`,
          `<p><strong>${event.title}</strong></p>`,
          `<p><strong>When:</strong> ${when}</p>`,
          loc, meet,
        ].join(""),
      });
      if (ok) reminded += 1;
    }
    done.push(event.id);
  }
  if (done.length > 0) {
    await raw(admin).from("calendar_events").update({ [stampCol]: nowISO }).in("id", done);
  }
  return { processed: events.length, reminded };
}

/**
 * Two-tier reminders for confirmed, timed meetings: one ~24h before and one ~1h before,
 * each stamped separately so it fires at most once. Best-effort per event.
 */
export async function sendDueReminders(now: Date = new Date()): Promise<{ processed: number; reminded: number }> {
  const admin = createServiceRoleClient();
  const a = await sendTier(admin, "24h", now);
  const b = await sendTier(admin, "1h", now);
  return { processed: a.processed + b.processed, reminded: a.reminded + b.reminded };
}
