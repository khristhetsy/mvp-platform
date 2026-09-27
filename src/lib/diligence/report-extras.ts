// Loads the extra facts the v2 diligence report prints beyond ReportPayload:
// sealed version, consent envelope, and (staff only) audit trail and visibility gate.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { DiligenceRole } from "./types";
import { GATE_SECTIONS, loadGate } from "./gate";
import type { AuditEntry, ConsentInfo, GateCell, ReportExtras, ReportVersionInfo } from "./report-model";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export async function loadReportExtras(
  supabase: SupabaseClient<Database>,
  eid: string,
  role: DiligenceRole,
): Promise<Pick<ReportExtras, "version" | "consent" | "audit" | "gate">> {
  const db = raw(supabase);
  const [{ data: versionRow }, { data: consentRow }] = await Promise.all([
    db.from("dd_report_versions").select("version, status, document_hash, created_at").eq("engagement_id", eid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("dd_consent_envelopes").select("status, signers, completed_at").eq("engagement_id", eid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const version = (versionRow as ReportVersionInfo | null) ?? null;
  const c = consentRow as { status: string; signers: unknown; completed_at: string | null } | null;
  const consent: ConsentInfo | null = c ? { status: c.status, signerCount: Array.isArray(c.signers) ? c.signers.length : 0, completed_at: c.completed_at } : null;

  if (role !== "admin") return { version, consent };

  const [{ data: auditRows }, gateMap] = await Promise.all([
    db.from("dd_audit_log").select("at, actor_id, action, target").eq("engagement_id", eid).order("at", { ascending: false }).limit(8),
    loadGate(supabase, eid),
  ]);
  const rows = (auditRows ?? []) as { at: string; actor_id: string | null; action: string; target: string | null }[];
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => Boolean(x)))];
  const names = new Map<string, string>();
  if (actorIds.length) {
    const { data: profiles } = await db.from("profiles").select("id, full_name").in("id", actorIds);
    for (const p of (profiles ?? []) as { id: string; full_name: string | null }[]) names.set(p.id, p.full_name ?? "");
  }
  const audit: AuditEntry[] = rows.map((r) => ({ at: r.at, actor: (r.actor_id && names.get(r.actor_id)) || "System", action: r.action, target: r.target }));

  const gate: Record<string, GateCell> = {};
  for (const s of GATE_SECTIONS) gate[s] = { founder: gateMap[s]?.founder_visible ?? false, investor: gateMap[s]?.investor_visible ?? false };

  return { version, consent, audit, gate };
}

/** Latest engagement linked to a company record, if any. */
export async function findEngagementForCompany(supabase: SupabaseClient<Database>, companyId: string): Promise<{ id: string } | null> {
  const { data } = await raw(supabase).from("dd_engagements").select("id").eq("company_id", companyId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as { id: string } | null) ?? null;
}
