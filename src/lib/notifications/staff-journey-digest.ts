// Once-daily digest to staff summarizing every founder who needs attention —
// stalled in a journey stage or waiting on stage approval. In-app + email, one
// per staff member, deduped to once a day. Best-effort — never throws into the
// cron. Complements the per-founder in-app alerts from the orchestration pass.

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification, hasRecentNotification } from "@/lib/notifications/notifications";
import { sendEmail } from "@/lib/email/send-email";
import type { SupabaseClient } from "@supabase/supabase-js";

const IDLE_DAYS = 7;
const DEDUPE_HOURS = 20; // once a day (allows a little clock drift on a daily cron)
const MAX_ROWS = 30;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://icapos.com").replace(/\/$/, "");
const BOARD_URL = `${SITE_URL}/admin/companies`;

const STAGE_LABEL: Record<string, string> = {
  initialize: "Onboarding",
  qualify: "Preparation",
  deploy: "Marketing",
  optimize: "Closing",
};

type StalledRow = { company: string; founder: string; stage: string; reason: string };

export async function digestStalledFoundersForStaff(): Promise<{ staffNotified: number; stalled: number }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceRoleClient() as unknown as SupabaseClient<any>;

    const { data: profs } = await db
      .from("profiles")
      .select("id, full_name, journey_stage, stage_approval_status")
      .in("journey_stage", ["qualify", "deploy", "optimize"])
      .limit(500);
    const founders = (profs ?? []) as {
      id: string;
      full_name: string | null;
      journey_stage: string | null;
      stage_approval_status: string | null;
    }[];
    if (founders.length === 0) return { staffNotified: 0, stalled: 0 };

    const ids = founders.map((f) => f.id);
    const { data: comps } = await db
      .from("companies")
      .select("founder_id, company_name, updated_at")
      .in("founder_id", ids);
    const companyByFounder = new Map<string, { company_name: string | null; updated_at: string | null }>();
    for (const c of (comps ?? []) as { founder_id: string | null; company_name: string | null; updated_at: string | null }[]) {
      if (c.founder_id) companyByFounder.set(c.founder_id, { company_name: c.company_name, updated_at: c.updated_at });
    }

    const idleCutoff = Date.now() - IDLE_DAYS * 24 * 60 * 60 * 1000;
    const rows: StalledRow[] = [];
    for (const f of founders) {
      const company = companyByFounder.get(f.id);
      const stageLabel = STAGE_LABEL[f.journey_stage ?? ""] ?? f.journey_stage ?? "—";
      if (f.stage_approval_status === "pending") {
        rows.push({ company: company?.company_name ?? "Company", founder: f.full_name ?? "Founder", stage: stageLabel, reason: "awaiting your approval" });
        continue;
      }
      const updatedMs = company?.updated_at ? new Date(company.updated_at).getTime() : 0;
      if (updatedMs && updatedMs < idleCutoff) {
        const days = Math.floor((Date.now() - updatedMs) / (24 * 60 * 60 * 1000));
        rows.push({ company: company?.company_name ?? "Company", founder: f.full_name ?? "Founder", stage: stageLabel, reason: `idle ${days}d` });
      }
    }
    if (rows.length === 0) return { staffNotified: 0, stalled: 0 };
    const capped = rows.slice(0, MAX_ROWS);

    const { data: staff } = await db
      .from("profiles")
      .select("id, email, full_name")
      .in("role", ["admin", "analyst"])
      .limit(50);
    const staffRows = (staff ?? []) as { id: string; email: string | null; full_name: string | null }[];
    if (staffRows.length === 0) return { staffNotified: 0, stalled: rows.length };

    const listHtml = capped
      .map((r) => `<li><b>${r.company}</b> — ${r.stage} · ${r.reason}</li>`)
      .join("");
    const listText = capped.map((r) => `- ${r.company} (${r.stage}) — ${r.reason}`).join("\n");

    let staffNotified = 0;
    for (const s of staffRows) {
      const already = await hasRecentNotification({
        recipientUserId: s.id,
        type: "journey_digest",
        withinHours: DEDUPE_HOURS,
      });
      if (already) continue;

      await createNotification({
        recipientUserId: s.id,
        type: "journey_digest",
        title: `${rows.length} founder${rows.length === 1 ? "" : "s"} need attention`,
        message: `${capped.map((r) => r.company).slice(0, 3).join(", ")}${rows.length > 3 ? ` and ${rows.length - 3} more` : ""} are stalled or awaiting approval.`,
        entityType: "company",
        entityId: null,
      });

      if (s.email) {
        await sendEmail({
          to: s.email,
          subject: `${rows.length} founder${rows.length === 1 ? "" : "s"} need attention today`,
          html: `<p>These founders are stalled in their journey or waiting on your approval:</p><ul>${listHtml}</ul><p><a href="${BOARD_URL}">Open the founder journey board →</a></p>`,
          text: `${rows.length} founders need attention:\n${listText}\n\n${BOARD_URL}`,
          fromName: "iCapOS",
        });
      }
      staffNotified += 1;
    }
    return { staffNotified, stalled: rows.length };
  } catch {
    return { staffNotified: 0, stalled: 0 };
  }
}
