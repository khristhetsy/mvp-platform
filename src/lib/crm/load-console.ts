// Admin CRM console — data layer (v1, Supabase-sourced).
// Founders come from companies+profiles (readiness proxy + derived stage).
// Investors come from investor_profiles+pipeline+kyc (fit proxy + derived rel).
// The match layer reuses the existing platform matching engine.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadFounderPlatformInvestorMatches } from "@/lib/founder-crm/platform-matches";
import type {
  FounderRecord,
  FounderStage,
  InvestorRecord,
  InvestorRel,
  MatchRow,
} from "@/lib/crm/types";

// Untyped raw client — several columns (investor_profiles.*) aren't in the
// generated Database types yet.
function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

function initials(name: string | null | undefined): string {
  if (!name) return "—";
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase() || "—";
}

const FOUNDER_FIELDS = [
  "company_name", "industry", "country", "business_description", "funding_amount",
  "use_of_funds", "revenue_stage", "team_summary", "cap_table_summary",
] as const;

function readinessProxy(row: Record<string, unknown>): number {
  const filled = FOUNDER_FIELDS.filter((f) => {
    const v = row[f];
    return v !== null && v !== undefined && String(v).trim() !== "";
  }).length;
  return Math.round((filled / FOUNDER_FIELDS.length) * 100);
}

function founderStage(score: number, status: string | null): FounderStage {
  const s = (status ?? "draft").toLowerCase();
  if (["closed", "archived", "completed"].includes(s)) return "closed";
  if (["published", "listed", "active", "raising"].includes(s) || score >= 90) return "raise";
  if (score >= 70) return "ready";
  if (score >= 40) return "building";
  return "onboard";
}

function raiseLabel(row: Record<string, unknown>): string {
  const stage = (row.revenue_stage as string | null)?.trim();
  const amt = Number(row.funding_amount ?? 0);
  const amtLabel = amt > 0 ? `$${(amt / 1_000_000).toFixed(1)}M` : null;
  return [stage, amtLabel].filter(Boolean).join(" · ") || "Raise TBD";
}

export async function loadFounderRecords(
  opts: { stage?: FounderStage; limit?: number } = {},
): Promise<FounderRecord[]> {
  const supabase = createServiceRoleClient();
  const { data } = await raw(supabase)
    .from("companies")
    .select(
      `id, company_name, industry, country, business_description, funding_amount,
       use_of_funds, revenue_stage, team_summary, cap_table_summary, status, updated_at,
       founder_id, profiles:founder_id ( full_name, email )`,
    )
    .order("updated_at", { ascending: false })
    .limit(opts.limit ?? 200);

  const rows = (data ?? []) as Record<string, unknown>[];
  const records = rows.map((row): FounderRecord => {
    const score = readinessProxy(row);
    const status = (row.status as string | null) ?? "draft";
    const prof = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as
      | { full_name?: string | null; email?: string | null }
      | null;
    return {
      id: String(row.id),
      name: String(row.company_name ?? "Unnamed company"),
      raiseLabel: raiseLabel(row),
      stage: founderStage(score, status),
      readiness: {
        score,
        scoreKind: status !== "draft" ? "crr" : "lead_prescore",
      },
      plan: "—",
      ownerInitials: initials(prof?.full_name ?? prof?.email ?? null),
      lastActivity: String(row.updated_at ?? new Date().toISOString()),
    };
  });
  return opts.stage ? records.filter((r) => r.stage === opts.stage) : records;
}

function investorFit(row: Record<string, unknown>): number {
  const checks = [
    Boolean(row.investor_type),
    row.check_size_min != null || row.check_size_max != null,
    Array.isArray(row.preferred_sectors) && (row.preferred_sectors as unknown[]).length > 0,
    Array.isArray(row.preferred_geographies) && (row.preferred_geographies as unknown[]).length > 0,
    Boolean(row.accreditation_verified) || String(row.kyc_status ?? "").toLowerCase() === "verified",
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function investorKyc(row: Record<string, unknown>): InvestorRecord["kyc"] {
  const s = String(row.kyc_status ?? "").toLowerCase();
  if (["verified", "approved"].includes(s)) return "Verified";
  if (["pending", "submitted", "in_review"].includes(s)) return "Pending";
  return "None";
}

function investorRel(fit: number, kyc: InvestorRecord["kyc"], pipelineCount: number): InvestorRel {
  if (kyc === "Verified" && pipelineCount > 0) return "allocating";
  if (pipelineCount > 0) return "active";
  if (fit >= 60) return "profiled";
  return "lead";
}

function mandate(row: Record<string, unknown>): string[] {
  const out: string[] = [];
  if (row.investor_type) out.push(String(row.investor_type));
  const sectors = Array.isArray(row.preferred_sectors) ? (row.preferred_sectors as string[]) : [];
  out.push(...sectors.slice(0, 3));
  const lo = Number(row.check_size_min ?? 0);
  const hi = Number(row.check_size_max ?? 0);
  if (lo > 0 || hi > 0) {
    const fmt = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`);
    out.push(`${lo > 0 ? fmt(lo) : "—"}–${hi > 0 ? fmt(hi) : "—"}`);
  }
  return out;
}

export async function loadInvestorRecords(
  opts: { kyc?: InvestorRecord["kyc"]; rel?: InvestorRel; limit?: number } = {},
): Promise<InvestorRecord[]> {
  const supabase = createServiceRoleClient();
  const [{ data: profs }, { data: pipelines }] = await Promise.all([
    raw(supabase)
      .from("investor_profiles")
      .select(`*, profiles:profile_id ( full_name, email )`)
      .limit(opts.limit ?? 200),
    raw(supabase).from("investor_pipeline").select("investor_id"),
  ]);

  const pipelineCount = new Map<string, number>();
  for (const p of (pipelines ?? []) as { investor_id: string }[]) {
    pipelineCount.set(p.investor_id, (pipelineCount.get(p.investor_id) ?? 0) + 1);
  }

  const records = ((profs ?? []) as Record<string, unknown>[]).map((row): InvestorRecord => {
    const investorId = String(row.profile_id ?? row.id ?? "");
    const prof = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as
      | { full_name?: string | null; email?: string | null }
      | null;
    const fit = investorFit(row);
    const kyc = investorKyc(row);
    const count = pipelineCount.get(investorId) ?? 0;
    return {
      id: investorId,
      name: prof?.full_name ?? prof?.email ?? "Unknown investor",
      kind: String(row.investor_type ?? "Investor"),
      fit,
      kyc,
      rel: investorRel(fit, kyc, count),
      mandate: mandate(row),
      indicatedCount: count,
      ownerInitials: initials(prof?.full_name ?? prof?.email ?? null),
      lastActivity: String(row.updated_at ?? new Date().toISOString()),
    };
  });

  let out = records;
  if (opts.kyc) out = out.filter((r) => r.kyc === opts.kyc);
  if (opts.rel) out = out.filter((r) => r.rel === opts.rel);
  return out;
}

// ── Match layer (platform-matching; indicated_interests deferred) ──────────────

export async function loadFounderMatches(companyId: string, limit = 8): Promise<MatchRow[]> {
  const supabase = createServiceRoleClient();
  const { data: company } = await raw(supabase).from("companies").select("*").eq("id", companyId).maybeSingle();
  if (!company) return [];
  const matches = await loadFounderPlatformInvestorMatches(company as Company, limit).catch(() => []);
  const ids = matches.map((m) => m.platformInvestorId);
  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: names } = await raw(supabase).from("profiles").select("id, full_name, email").in("id", ids);
    for (const n of (names ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
      nameById.set(n.id, n.full_name ?? n.email ?? "Investor");
    }
  }
  return matches.map((m) => ({
    name: nameById.get(m.platformInvestorId) ?? m.label,
    context: m.matchReasons?.[0] ?? m.label,
    fit: m.matchScore,
    interest: "watching" as const,
  }));
}

export async function loadInvestorMatches(investorId: string, limit = 8): Promise<MatchRow[]> {
  const supabase = createServiceRoleClient();
  const { data: prof } = await raw(supabase)
    .from("investor_profiles")
    .select("preferred_sectors, preferred_geographies")
    .eq("profile_id", investorId)
    .maybeSingle();
  const sectors = new Set(
    (Array.isArray(prof?.preferred_sectors) ? (prof!.preferred_sectors as string[]) : []).map((s) => s.toLowerCase()),
  );
  const { data: companies } = await raw(supabase)
    .from("companies")
    .select("id, company_name, industry, revenue_stage, funding_amount, status")
    .neq("status", "draft")
    .limit(120);

  const scored = ((companies ?? []) as Record<string, unknown>[])
    .map((c) => {
      const industry = String(c.industry ?? "").toLowerCase();
      const sectorHit = industry && [...sectors].some((s) => industry.includes(s) || s.includes(industry));
      const readiness = readinessProxy(c);
      const fit = Math.min(100, (sectorHit ? 60 : 30) + Math.round(readiness / 3));
      return {
        name: String(c.company_name ?? "Company"),
        context: `${c.revenue_stage ?? "Raise"} · CRR ${readiness}`,
        fit,
        interest: "watching" as const,
      };
    })
    .sort((a, b) => b.fit - a.fit)
    .slice(0, limit);
  return scored;
}
