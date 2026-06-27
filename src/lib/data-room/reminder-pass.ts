// Scheduled escalating "finish your data room" cadence. Runs inside the
// twice-daily orchestration cron (best-effort). Dedupe via
// notifyCompanyFounderIfNotRecent keeps the cadence to ~one nudge every 60h;
// the in-app notification and the email fire together so they stay in sync.

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { computeDataRoomState } from "@/lib/data-room/completeness";
import { notifyCompanyFounderIfNotRecent } from "@/lib/notifications/notifications";
import { sendDataRoomReminderEmail } from "@/lib/data-room/email";
import type { DocumentRecord } from "@/lib/supabase/types";

const FIRST_NUDGE_AFTER_DAYS = 2; // grace period before the first chase
const DEDUPE_HOURS = 60; // ~ one reminder every 2.5 days

export interface DataRoomReminderResult {
  considered: number;
  notified: number;
  emailed: number;
}

function daysSince(iso: string | null | undefined, now: number): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
}

export async function runDataRoomReminderPass(): Promise<DataRoomReminderResult> {
  const admin = createServiceRoleClient();
  const now = Date.now();
  const result: DataRoomReminderResult = { considered: 0, notified: 0, emailed: 0 };

  const { data: companies } = await admin
    .from("companies")
    .select("id, company_name, founder_id, created_at")
    .not("founder_id", "is", null);

  const list = (companies ?? []) as Array<{ id: string; company_name: string | null; founder_id: string | null; created_at: string | null }>;
  if (list.length === 0) return result;

  const companyIds = list.map((c) => c.id);
  const founderIds = list.map((c) => c.founder_id).filter((v): v is string => Boolean(v));

  const [{ data: docs }, { data: profiles }] = await Promise.all([
    admin.from("documents").select("company_id, document_type, status, created_at").in("company_id", companyIds),
    admin.from("profiles").select("id, full_name, email").in("id", founderIds),
  ]);

  const docsByCompany = new Map<string, DocumentRecord[]>();
  for (const d of (docs ?? []) as Array<DocumentRecord & { company_id: string }>) {
    const arr = docsByCompany.get(d.company_id) ?? [];
    arr.push(d);
    docsByCompany.set(d.company_id, arr);
  }
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  for (const company of list) {
    const companyDocs = docsByCompany.get(company.id) ?? [];
    const state = computeDataRoomState(companyDocs);
    if (state.coreComplete) continue; // only chase missing investor-access essentials

    const lastDocAt = companyDocs.map((d) => d.created_at).filter(Boolean).sort().at(-1) as string | undefined;
    const stalledDays = lastDocAt ? daysSince(lastDocAt, now) : daysSince(company.created_at, now);
    if (stalledDays < FIRST_NUDGE_AFTER_DAYS) continue;

    result.considered += 1;

    const missingLabels = state.coreMissing.map((i) => i.label).join(", ");
    const urgent = stalledDays >= 14;
    const firm = stalledDays >= 7;
    const title = urgent
      ? "Final reminder: your data room is blocking investor access"
      : firm
        ? "Investors can't reach you until your data room is complete"
        : "Finish your data room to unlock investor access";
    const message = `Your data room is ${state.percent}% complete. Upload your investor-access essentials (${missingLabels}) to be visible to investors and request introductions.`;

    const created = await notifyCompanyFounderIfNotRecent(company.id, {
      type: "data_room_reminder",
      title,
      message,
      entityType: "company",
      entityId: company.id,
      withinHours: DEDUPE_HOURS,
    });

    if (!created) continue; // deduped — skip email too so they stay in sync
    result.notified += 1;

    const profile = company.founder_id ? profileById.get(company.founder_id) : null;
    if (profile?.email) {
      const ok = await sendDataRoomReminderEmail({
        to: profile.email,
        founderName: profile.full_name ?? null,
        companyName: company.company_name ?? "your company",
        state,
      });
      if (ok) result.emailed += 1;
    }
  }

  return result;
}
