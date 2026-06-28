// Activation funnels computed directly from Supabase (service-role) — no
// dependency on PostHog being configured. Powers the admin funnels report and
// the weekly digest. Founder funnel = signup → upload → core docs → published.
// Investor funnel = signup → submitted → approved → first interest.

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { computeDataRoomState } from "@/lib/data-room/completeness";
import type { DocumentRecord } from "@/lib/supabase/types";

export interface FunnelStep {
  label: string;
  count: number;
  /** Conversion from the previous step (0..1). null for the first step. */
  fromPrev: number | null;
  /** Conversion from the very top of the funnel (0..1). */
  fromTop: number;
}

export interface ActivationFunnels {
  founder: FunnelStep[];
  investor: FunnelStep[];
  generatedAt: string;
}

function buildSteps(rows: Array<{ label: string; count: number }>): FunnelStep[] {
  const top = rows[0]?.count ?? 0;
  return rows.map((r, i) => ({
    label: r.label,
    count: r.count,
    fromPrev: i === 0 ? null : rows[i - 1].count > 0 ? r.count / rows[i - 1].count : 0,
    fromTop: top > 0 ? r.count / top : 0,
  }));
}

export async function loadActivationFunnels(): Promise<ActivationFunnels> {
  const admin = createServiceRoleClient();

  // ── Founder funnel ──────────────────────────────────────────────────────
  const [{ count: founderSignups }, { data: companies }, { data: founderDocs }] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "founder"),
    admin.from("companies").select("id, is_published"),
    admin.from("documents").select("company_id, document_type, status"),
  ]);

  const companyList = (companies ?? []) as Array<{ id: string; is_published: boolean | null }>;
  const publishedCount = companyList.filter((c) => c.is_published).length;

  const docsByCompany = new Map<string, DocumentRecord[]>();
  for (const d of (founderDocs ?? []) as Array<DocumentRecord & { company_id: string }>) {
    const arr = docsByCompany.get(d.company_id) ?? [];
    arr.push(d);
    docsByCompany.set(d.company_id, arr);
  }
  const companiesWithAnyDoc = docsByCompany.size;
  let companiesCoreComplete = 0;
  for (const docs of docsByCompany.values()) {
    if (computeDataRoomState(docs).coreComplete) companiesCoreComplete += 1;
  }

  const founder = buildSteps([
    { label: "Signed up", count: founderSignups ?? 0 },
    { label: "Uploaded a document", count: companiesWithAnyDoc },
    { label: "Core docs complete", count: companiesCoreComplete },
    { label: "Listed to investors", count: publishedCount },
  ]);

  // ── Investor funnel ─────────────────────────────────────────────────────
  const [{ count: investorSignups }, { data: profiles }, { data: interests }] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "investor"),
    admin.from("investor_profiles").select("approval_status"),
    admin.from("investor_interests").select("investor_id"),
  ]);

  const profileRows = (profiles ?? []) as Array<{ approval_status: string | null }>;
  const submittedCount = profileRows.filter((p) => p.approval_status && p.approval_status !== "draft").length;
  const approvedCount = profileRows.filter((p) => p.approval_status === "approved").length;
  const interestInvestors = new Set((interests ?? []).map((r) => (r as { investor_id: string }).investor_id)).size;

  const investor = buildSteps([
    { label: "Signed up", count: investorSignups ?? 0 },
    { label: "Submitted for approval", count: submittedCount },
    { label: "Approved", count: approvedCount },
    { label: "Expressed interest", count: interestInvestors },
  ]);

  return { founder, investor, generatedAt: new Date().toISOString() };
}
