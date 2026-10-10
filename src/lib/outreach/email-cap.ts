import "server-only";

/**
 * Manual outreach email cap: the plan's emails per 30 day period plus any
 * investor directory top up. Checked when a sequence starts (new recipients'
 * first emails must fit) and by the send pass (stops sending at the cap; held
 * steps go out after the period resets).
 */
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { founderLimits } from "@/lib/investor-directory/db";
import { decideEmailStart, emailCapMessage } from "@/lib/investor-directory/allowance";
import { PLATFORM_TZ } from "@/lib/time/platform-tz";
import type { FounderLimits } from "@/lib/investor-directory/types";

export type EmailCapCheck =
  | { ok: true; limits: FounderLimits }
  | { ok: false; message: string; cap: number; used: number; remaining: number; resetsAt: string };

export function resetLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: PLATFORM_TZ }) + " PT";
}

/** May this start add the selected contacts? Counts selected contacts with an email not yet enrolled. */
export async function checkManualEmailCap(input: { founderId: string; companyId: string; selectedIds: readonly string[] }): Promise<EmailCapCheck> {
  const limits = await founderLimits(input.founderId);
  const db = serviceRoleClientUntyped();
  const selected = [...new Set(input.selectedIds)];
  let adding = 0;
  if (selected.length) {
    const [{ data: enrolled }, { data: contacts }] = await Promise.all([
      db.from("founder_manual_outreach_recipients").select("contact_id").eq("company_id", input.companyId).in("contact_id", selected),
      db.from("founder_investor_contacts").select("id, email").eq("company_id", input.companyId).in("id", selected),
    ]);
    const already = new Set(((enrolled ?? []) as Array<{ contact_id: string }>).map((r) => r.contact_id));
    adding = ((contacts ?? []) as Array<{ id: string; email: string | null }>).filter((c) => !already.has(c.id) && c.email?.trim()).length;
  }
  const d = decideEmailStart(limits.emails, limits.emailsUsed, adding);
  if (d.ok) return { ok: true, limits };
  return {
    ok: false,
    message: emailCapMessage(d, resetLabel(limits.periodEnd)),
    cap: d.cap,
    used: d.used,
    remaining: d.remaining,
    resetsAt: limits.periodEnd,
  };
}

/** Log one Manual outreach email that really went out. Never throws. */
export async function recordManualSend(row: { founderId: string | null; companyId: string; recipientId: string; email: string; stepIndex: number }): Promise<void> {
  try {
    await serviceRoleClientUntyped().from("manual_outreach_sends").insert({
      founder_id: row.founderId,
      company_id: row.companyId,
      recipient_id: row.recipientId,
      email: row.email,
      step_index: row.stepIndex,
    });
  } catch {
    // The log is what the cap counts; a missed row only under counts by one.
  }
}
