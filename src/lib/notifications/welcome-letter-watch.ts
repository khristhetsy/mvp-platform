import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification, hasRecentNotification } from "@/lib/notifications/notifications";
import { WELCOME_LETTER_SOURCE } from "@/lib/notifications/founder-welcome-letter";

/**
 * Staff bell alerts for the welcome letter, only when something is wrong:
 *  - it bounced (from the email provider's webhook), or
 *  - it is still unopened 2 days after it went out (daily check).
 * Nothing is sent when the letter was delivered and opened.
 */
export const WELCOME_BOUNCED_TYPE = "staff_welcome_letter_bounced";
export const WELCOME_UNOPENED_TYPE = "staff_welcome_letter_unopened";

const UNOPENED_AFTER_HOURS = 48;
/** Letters older than this are not chased (avoids alerting on old history). */
const LOOKBACK_DAYS = 7;

type LetterRow = {
  id: number;
  to_email: string;
  recipient_user_id: string | null;
  created_at: string;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return createServiceRoleClient();
}

async function companyFor(founderId: string): Promise<{ id: string; name: string } | null> {
  const { data } = await db()
    .from("companies")
    .select("id, company_name")
    .eq("founder_id", founderId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const r = data as { id: string; company_name: string | null } | null;
  return r ? { id: r.id, name: r.company_name?.trim() || "A new client" } : null;
}

async function staffIds(): Promise<string[]> {
  const { data } = await db().from("profiles").select("id").in("role", ["admin", "analyst"]);
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}

async function alertStaff(input: { type: string; founderId: string; title: string; message: (company: string) => string; withinHours: number }): Promise<number> {
  const company = await companyFor(input.founderId);
  const entityId = company?.id ?? input.founderId;
  const link = company ? `/admin/companies/${company.id}#tools` : "/admin/activity/sent";
  let sent = 0;
  for (const id of await staffIds()) {
    if (await hasRecentNotification({ recipientUserId: id, type: input.type, entityId, withinHours: input.withinHours })) continue;
    const n = await createNotification({
      recipientUserId: id,
      actorUserId: input.founderId,
      type: input.type,
      title: input.title,
      message: input.message(company?.name ?? "A new client"),
      entityType: "company",
      entityId,
      deepLink: link,
      severity: "high",
      dedupeKey: `${input.type}:${entityId}`,
    });
    if (n) sent += 1;
  }
  return sent;
}

/** Called from the email provider webhook on a bounce. */
export async function onWelcomeLetterBounce(providerId: string): Promise<void> {
  try {
    const { data } = await db()
      .from("email_log")
      .select("id, to_email, recipient_user_id")
      .eq("provider_id", providerId)
      .eq("source", WELCOME_LETTER_SOURCE);
    for (const row of (data ?? []) as Array<{ to_email: string; recipient_user_id: string | null }>) {
      if (!row.recipient_user_id) continue;
      await alertStaff({
        type: WELCOME_BOUNCED_TYPE,
        founderId: row.recipient_user_id,
        title: "Welcome letter bounced",
        message: () => `The welcome letter to ${row.to_email} bounced. Check the founder's email address.`,
        withinHours: 24,
      });
    }
  } catch (error) {
    console.warn("[welcome-letter-watch] bounce failed", error);
  }
}

/** Pure: which letters need an "unopened" alert. Only each founder's latest letter counts. */
export function unopenedLetters(rows: LetterRow[], now: Date = new Date()): LetterRow[] {
  const latest = new Map<string, LetterRow>();
  for (const r of rows) {
    if (!r.recipient_user_id) continue;
    const prev = latest.get(r.recipient_user_id);
    if (!prev || r.created_at > prev.created_at) latest.set(r.recipient_user_id, r);
  }
  const cutoff = now.getTime() - UNOPENED_AFTER_HOURS * 3_600_000;
  return [...latest.values()].filter(
    (r) => !r.opened_at && !r.clicked_at && !r.bounced_at && new Date(r.created_at).getTime() <= cutoff,
  );
}

/** Daily: alert staff about welcome letters still unopened after 2 days. */
export async function checkUnopenedWelcomeLetters(now: Date = new Date()): Promise<{ checked: number; alerted: number }> {
  try {
    const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString();
    const { data } = await db()
      .from("email_log")
      .select("id, to_email, recipient_user_id, created_at, opened_at, clicked_at, bounced_at")
      .eq("source", WELCOME_LETTER_SOURCE)
      .eq("status", "sent")
      .gte("created_at", since);
    const rows = (data ?? []) as LetterRow[];
    let alerted = 0;
    for (const r of unopenedLetters(rows, now)) {
      alerted += await alertStaff({
        type: WELCOME_UNOPENED_TYPE,
        founderId: r.recipient_user_id as string,
        title: "Welcome letter not opened",
        message: (company) => `${company} has not opened the welcome letter after 2 days. Worth a call.`,
        withinHours: 24 * 30,
      });
    }
    return { checked: rows.length, alerted };
  } catch (error) {
    console.warn("[welcome-letter-watch] unopened check failed", error);
    return { checked: 0, alerted: 0 };
  }
}
