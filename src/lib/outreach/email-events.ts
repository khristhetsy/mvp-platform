import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Records email-open events from the provider (Resend) against outreach
 * recipients. Matches by the recipient's email address:
 *  - Manual recipients store the email directly.
 *  - Automated recipients store a profile id, so we resolve email → profile id.
 * Only the first open per recipient is recorded (opened_at stays put).
 */

function client(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export async function recordEmailOpen(toEmails: string[]): Promise<{ marked: number }> {
  const emails = [...new Set(toEmails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")))];
  if (emails.length === 0) return { marked: 0 };

  const db = client();
  const nowIso = new Date().toISOString();
  let marked = 0;

  // Manual recipients — matched directly by email.
  {
    const { data } = await db
      .from("founder_manual_outreach_recipients")
      .update({ opened_at: nowIso })
      .in("email", emails)
      .is("opened_at", null)
      .select("id");
    marked += ((data ?? []) as Array<{ id: string }>).length;
  }

  // Automated recipients — resolve email → profile id, then match by investor_ref.
  {
    const { data: profs } = await db.from("profiles").select("id, email").in("email", emails);
    const profileIds = ((profs ?? []) as Array<{ id: string; email: string | null }>).map((p) => p.id);
    if (profileIds.length > 0) {
      const { data } = await db
        .from("investor_outreach_recipients")
        .update({ opened_at: nowIso })
        .in("investor_ref", profileIds)
        .is("opened_at", null)
        .select("id");
      marked += ((data ?? []) as Array<{ id: string }>).length;
    }
  }

  return { marked };
}
