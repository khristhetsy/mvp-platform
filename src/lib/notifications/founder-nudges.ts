// Proactive nudges for founders stalled in Preparation (qualify) — the stage
// where most companies die. Today the only cron nudge is scoped to onboarding
// and everything is in-app; this reaches a founder who finished onboarding but
// hasn't cleared Preparation, IN-APP AND BY EMAIL (the channel that reaches a
// founder who's stopped logging in). Deduped via hasRecentNotification so it
// fires at most once per window. Best-effort — never throws into the cron.

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification, hasRecentNotification } from "@/lib/notifications/notifications";
import { sendEmail } from "@/lib/email/send-email";
import type { SupabaseClient } from "@supabase/supabase-js";

const INACTIVE_DAYS = 5; // no company movement for this long
const DEDUPE_HOURS = 24 * 7; // at most one nudge a week

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://icapos.com").replace(/\/$/, "");
const PREP_URL = `${SITE_URL}/founder/stages/preparation`;

type ProfileRow = { id: string; email: string | null; full_name: string | null };
type CompanyRow = { founder_id: string | null; company_name: string | null; updated_at: string | null };

export async function nudgeStalledPreparationFounders(): Promise<{ nudged: number }> {
  let nudged = 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceRoleClient() as unknown as SupabaseClient<any>;

    // Founders in Preparation who haven't submitted (self-serve incomplete —
    // docs/score not yet met). Pending/approved founders have done their part.
    const { data: profs } = await db
      .from("profiles")
      .select("id, email, full_name")
      .eq("journey_stage", "qualify")
      .is("stage_approval_status", null)
      .limit(200);
    const founders = (profs ?? []) as ProfileRow[];
    if (founders.length === 0) return { nudged: 0 };

    const ids = founders.map((f) => f.id);
    const inactiveCutoff = new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: comps } = await db
      .from("companies")
      .select("founder_id, company_name, updated_at")
      .in("founder_id", ids);
    const companyByFounder = new Map<string, CompanyRow>();
    for (const c of (comps ?? []) as CompanyRow[]) {
      if (c.founder_id) companyByFounder.set(c.founder_id, c);
    }

    for (const f of founders) {
      const company = companyByFounder.get(f.id);
      // Only nudge founders whose company has genuinely gone quiet.
      if (!company || (company.updated_at && company.updated_at >= inactiveCutoff)) continue;

      const already = await hasRecentNotification({
        recipientUserId: f.id,
        type: "preparation_nudge",
        withinHours: DEDUPE_HOURS,
      });
      if (already) continue;

      await createNotification({
        recipientUserId: f.id,
        type: "preparation_nudge",
        title: "You're one step from investor matching",
        message: "Finish your Preparation checklist — your readiness score and documents — to get matched with investors.",
        entityType: "company",
        entityId: null,
      });

      if (f.email) {
        const name = f.full_name?.split(" ")[0] ?? "there";
        await sendEmail({
          to: f.email,
          subject: "You're one step from investor matching",
          html: `<p>Hi ${name},</p><p>You've done the hard part. Finish your <b>Preparation</b> checklist — your Capital Readiness score and your documents — and iCapOS will match you with investors from the iCFO network.</p><p><a href="${PREP_URL}">Pick up where you left off →</a></p><p style="color:#667;font-size:12px">Every iCapOS tool is free. iCapOS is not a broker-dealer and does not raise capital or guarantee funding.</p>`,
          text: `Hi ${name}, finish your Preparation checklist (readiness score + documents) to get matched with investors: ${PREP_URL}`,
          fromName: "iCapOS",
        });
      }
      nudged += 1;
    }
  } catch {
    /* best-effort — telemetry/nudges must never break the cron */
  }
  return { nudged };
}
