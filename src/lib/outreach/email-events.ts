import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Records email engagement events from the provider (Resend) against outreach
 * recipients. Matches by the recipient's email address:
 *  - Manual recipients store the email directly.
 *  - Automated recipients store a profile id, so we resolve email → profile id.
 * Each timestamp is only set once (stays put on repeat events). A click also
 * backfills the open time — you can't click without opening.
 */

function client(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

function normalize(emails: string[]): string[] {
  return [...new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")))];
}

/** Update the given timestamp columns (only where currently null) on both tables. */
async function markRecipients(emails: string[], columns: string[]): Promise<number> {
  const list = normalize(emails);
  if (list.length === 0) return 0;
  const db = client();
  const nowIso = new Date().toISOString();
  const patch: Record<string, string> = {};
  for (const c of columns) patch[c] = nowIso;
  // Only rows missing the primary column get updated (first event wins).
  const guard = columns[0];
  let marked = 0;

  {
    const { data } = await db
      .from("founder_manual_outreach_recipients")
      .update(patch)
      .in("email", list)
      .is(guard, null)
      .select("id");
    marked += ((data ?? []) as Array<{ id: string }>).length;
  }

  {
    const { data: profs } = await db.from("profiles").select("id").in("email", list);
    const ids = ((profs ?? []) as Array<{ id: string }>).map((p) => p.id);
    if (ids.length > 0) {
      const { data } = await db
        .from("investor_outreach_recipients")
        .update(patch)
        .in("investor_ref", ids)
        .is(guard, null)
        .select("id");
      marked += ((data ?? []) as Array<{ id: string }>).length;
    }
  }

  return marked;
}

export async function recordEmailOpen(toEmails: string[]): Promise<{ marked: number }> {
  return { marked: await markRecipients(toEmails, ["opened_at"]) };
}

export async function recordEmailClick(toEmails: string[]): Promise<{ marked: number }> {
  const marked = await markRecipients(toEmails, ["clicked_at"]);
  // A click implies an open — backfill opened_at only if it isn't already set,
  // so an earlier open time is preserved.
  await markRecipients(toEmails, ["opened_at"]);
  return { marked };
}
