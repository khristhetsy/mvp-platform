import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { contactsFor, listIntroductions } from "@/lib/icfo-events/introductions-server";
import { acceptedCount, summarizeByFounder, type FounderPanelRow } from "@/lib/icfo-events/founder-status";

/** Escapes the characters LIKE treats as patterns, so an event title is matched literally. */
const likeLiteral = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/**
 * One row per presenter: where their introductions stand and when staff last
 * emailed them. "Last emailed" comes from the outbound email log, so it counts
 * only the status email, which has its own subject, and never the automatic
 * pick-a-time emails.
 */
export async function loadFounderPanel(eventId: string, eventTitle: string): Promise<FounderPanelRow[]> {
  const intros = await listIntroductions(eventId);
  const byFounder = summarizeByFounder(intros);
  if (!byFounder.size) return [];

  const contacts = await contactsFor([...byFounder.keys()]);

  const emails = [...new Set(
    [...byFounder.keys()].map((id) => contacts.get(id)?.email?.toLowerCase()).filter((e): e is string => Boolean(e)),
  )];
  const lastByEmail = new Map<string, string>();
  if (emails.length && eventTitle) {
    const db = createServiceRoleClient() as unknown as SupabaseClient;
    const { data, error } = await db
      .from("email_log")
      .select("to_email, created_at")
      .eq("status", "sent")
      .like("subject", `Your introductions at ${likeLiteral(eventTitle)}:%`)
      .in("to_email", emails)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[founder-panel] email log failed:", error.message);
    } else {
      for (const r of (data ?? []) as { to_email: string; created_at: string }[]) {
        const key = String(r.to_email).toLowerCase();
        if (!lastByEmail.has(key)) lastByEmail.set(key, String(r.created_at));
      }
    }
  }

  return [...byFounder.values()]
    .map((s) => {
      const c = contacts.get(s.founderRegId);
      return {
        name: c?.name ?? "Presenter",
        introduced: s.introduced,
        accepted: acceptedCount(s),
        awaiting: s.awaiting,
        declined: s.declined,
        timeSet: s.scheduled.length,
        lastEmailedAt: (c?.email && lastByEmail.get(c.email.toLowerCase())) || null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
