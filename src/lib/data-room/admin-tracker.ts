// Admin "stuck founders" cockpit data. Service-role only. For every founder
// company, computes data-room completeness + how long they've been stalled so
// staff can chase the ones who haven't finished diligence.

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { computeDataRoomState } from "@/lib/data-room/completeness";
import type { DocumentRecord } from "@/lib/supabase/types";

export interface DataRoomTrackerRow {
  companyId: string;
  companyName: string;
  founderId: string | null;
  founderName: string | null;
  founderEmail: string | null;
  percent: number;
  coreComplete: boolean;
  coreMissingLabels: string[];
  missingCount: number;
  published: boolean;
  daysSinceCreated: number;
  daysSinceLastDoc: number | null;
  lastNudgeAt: string | null;
}

export interface DataRoomTrackerSummary {
  totalFounders: number;
  fullyComplete: number;
  coreComplete: number;
  stalled: number; // incomplete core + 7+ days since last doc (or since signup)
}

function daysBetween(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
}

export async function loadDataRoomTracker(): Promise<{ rows: DataRoomTrackerRow[]; summary: DataRoomTrackerSummary }> {
  const admin = createServiceRoleClient();
  const now = Date.now();

  const { data: companies } = await admin
    .from("companies")
    .select("id, company_name, founder_id, created_at, is_published")
    .order("created_at", { ascending: true });

  const companyList = (companies ?? []) as Array<{
    id: string;
    company_name: string | null;
    founder_id: string | null;
    created_at: string | null;
    is_published: boolean | null;
  }>;
  if (companyList.length === 0) {
    return { rows: [], summary: { totalFounders: 0, fullyComplete: 0, coreComplete: 0, stalled: 0 } };
  }

  const companyIds = companyList.map((c) => c.id);
  const founderIds = companyList.map((c) => c.founder_id).filter((v): v is string => Boolean(v));

  const [{ data: docs }, { data: profiles }, { data: nudges }] = await Promise.all([
    admin.from("documents").select("company_id, document_type, status, created_at").in("company_id", companyIds),
    founderIds.length
      ? admin.from("profiles").select("id, full_name, email").in("id", founderIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; email: string | null }> }),
    founderIds.length
      ? admin
          .from("notifications")
          .select("recipient_user_id, created_at")
          .eq("type", "data_room_reminder")
          .in("recipient_user_id", founderIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<{ recipient_user_id: string; created_at: string }> }),
  ]);

  const docsByCompany = new Map<string, DocumentRecord[]>();
  for (const d of (docs ?? []) as Array<DocumentRecord & { company_id: string }>) {
    const list = docsByCompany.get(d.company_id) ?? [];
    list.push(d);
    docsByCompany.set(d.company_id, list);
  }
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const lastNudgeByFounder = new Map<string, string>();
  for (const n of (nudges ?? []) as Array<{ recipient_user_id: string; created_at: string }>) {
    if (!lastNudgeByFounder.has(n.recipient_user_id)) lastNudgeByFounder.set(n.recipient_user_id, n.created_at);
  }

  const rows: DataRoomTrackerRow[] = companyList.map((c) => {
    const companyDocs = docsByCompany.get(c.id) ?? [];
    const state = computeDataRoomState(companyDocs);
    const profile = c.founder_id ? profileById.get(c.founder_id) : null;
    const lastDocAt = companyDocs
      .map((d) => d.created_at)
      .filter(Boolean)
      .sort()
      .at(-1) as string | undefined;

    return {
      companyId: c.id,
      companyName: c.company_name ?? "Unnamed company",
      founderId: c.founder_id,
      founderName: profile?.full_name ?? null,
      founderEmail: profile?.email ?? null,
      percent: state.percent,
      coreComplete: state.coreComplete,
      coreMissingLabels: state.coreMissing.map((i) => i.label),
      missingCount: state.missingCount,
      published: Boolean(c.is_published),
      daysSinceCreated: daysBetween(c.created_at, now) ?? 0,
      daysSinceLastDoc: daysBetween(lastDocAt ?? null, now),
      lastNudgeAt: c.founder_id ? lastNudgeByFounder.get(c.founder_id) ?? null : null,
    };
  });

  const summary: DataRoomTrackerSummary = {
    totalFounders: rows.length,
    fullyComplete: rows.filter((r) => r.missingCount === 0).length,
    coreComplete: rows.filter((r) => r.coreComplete).length,
    stalled: rows.filter((r) => !r.coreComplete && (r.daysSinceLastDoc ?? r.daysSinceCreated) >= 7).length,
  };

  // Most-stalled / least-complete first.
  rows.sort((a, b) => {
    if (a.coreComplete !== b.coreComplete) return a.coreComplete ? 1 : -1;
    if (a.percent !== b.percent) return a.percent - b.percent;
    return (b.daysSinceLastDoc ?? b.daysSinceCreated) - (a.daysSinceLastDoc ?? a.daysSinceCreated);
  });

  return { rows, summary };
}
