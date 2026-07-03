// Admin CRM console — data layer (v1, Supabase-sourced).
// Founders come from companies+profiles (readiness proxy + derived stage).
// Investors come from investor_profiles+pipeline+kyc (fit proxy + derived rel).
// The match layer reuses the existing platform matching engine.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadFounderPlatformInvestorMatches } from "@/lib/founder-crm/platform-matches";
import type {
  ContactDetails,
  FounderRecord,
  FounderStage,
  InvestorRecord,
  InvestorRel,
  MatchRow,
  UnclassifiedRecord,
} from "@/lib/crm/types";

// Structured profile captured from Odoo Studio fields (see odoo/adapter.ts).
type OdooProfile = {
  membership?: string | null;
  investorTypes?: string[];
  industries?: string[];
  capital?: string[];
  fundingStages?: string[];
  operatingStages?: string[];
  businessEntity?: string[];
  plan?: string | null;
  leadSource?: string | null;
  extra?: Record<string, unknown>;
};

function stripHtml(s: unknown): string | null {
  if (!s || typeof s !== "string") return null;
  const t = s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return t || null;
}

/** Build the contact-detail + profile block shown in the drawer, from a mirrored row. */
function contactDetails(m: Record<string, unknown>): ContactDetails {
  const row = (m.raw as Record<string, unknown>) ?? {};
  const p = odooProfile(m);
  const country = Array.isArray(row.country_id) ? String((row.country_id as unknown[])[1]) : null;
  const location = [row.city, country].filter(Boolean).map(String).join(", ") || null;

  const profile: { label: string; values: string[] }[] = [];
  if (p) {
    const add = (label: string, vals: unknown) => {
      const a = asList(vals);
      if (a.length) profile.push({ label, values: a });
    };
    add("Investor type", p.investorTypes);
    add("Industries", p.industries);
    add("Capital", p.capital);
    add("Funding stage", p.fundingStages);
    add("Operating stage", p.operatingStages);
    add("Business entity", p.businessEntity);
    for (const [label, val] of Object.entries(p.extra ?? {})) {
      const a = Array.isArray(val) ? val.map(String) : [String(val)];
      if (a.length && a[0] && a[0] !== "null" && a[0] !== "false") profile.push({ label, values: a });
    }
  }

  return {
    email: (m.email as string) ?? null,
    phone: (row.phone as string) || (row.mobile as string) || null,
    website: (row.website as string) || null,
    title: (row.function as string) || null,
    company: (m.company as string) ?? null,
    location,
    description: stripHtml(row.comment),
    leadSource: p?.leadSource ?? null,
    membership: p?.membership ?? null,
    profile,
  };
}

function odooProfile(m: Record<string, unknown>): OdooProfile | null {
  const raw = m.raw as Record<string, unknown> | null | undefined;
  const p = raw?.__profile as OdooProfile | undefined;
  return p ?? null;
}

function asList(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).map(String) : [];
}

/** Investor mandate chips from the Odoo profile: type(s), sectors, capital, ticket sizes. */
function mandateFromProfile(p: OdooProfile): string[] {
  const out: string[] = [];
  out.push(...asList(p.investorTypes).slice(0, 2));
  out.push(...asList(p.industries).slice(0, 3));
  out.push(...asList(p.capital).slice(0, 2));
  // Surface any money/size-like extras (e.g. "Investment size", "Check size").
  for (const [label, val] of Object.entries(p.extra ?? {})) {
    if (/size|amount|ticket|check|invest|capital|aum/i.test(label)) {
      const s = Array.isArray(val) ? val.join(", ") : String(val);
      if (s && s !== "null") out.push(`${label}: ${s}`);
    }
  }
  return out.slice(0, 8);
}

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

/** Read the connector mirror for a module. Empty until an import has run. */
async function loadMirror(module: "founder" | "investor", limit: number): Promise<Record<string, unknown>[]> {
  const supabase = createServiceRoleClient();
  const { data } = await raw(supabase)
    .from("crm_contacts")
    .select("*")
    .eq("module", module)
    .order("synced_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Record<string, unknown>[];
}

/** Build founder records from mirrored contacts, enriched with company intelligence where linked. */
async function foundersFromMirror(mirror: Record<string, unknown>[], stage?: FounderStage): Promise<FounderRecord[]> {
  const supabase = createServiceRoleClient();
  const profileIds = mirror.map((m) => m.supabase_profile_id).filter(Boolean) as string[];
  const companyByFounder = new Map<string, Record<string, unknown>>();
  if (profileIds.length) {
    const { data } = await raw(supabase)
      .from("companies")
      .select("id, company_name, industry, country, business_description, funding_amount, use_of_funds, revenue_stage, team_summary, cap_table_summary, status, updated_at, founder_id")
      .in("founder_id", profileIds);
    for (const c of (data ?? []) as Record<string, unknown>[]) companyByFounder.set(String(c.founder_id), c);
  }
  const records = mirror.map((m): FounderRecord => {
    const company = m.supabase_profile_id ? companyByFounder.get(String(m.supabase_profile_id)) : undefined;
    const score = company ? readinessProxy(company) : 0;
    return {
      id: company ? String(company.id) : `mirror:${m.external_id}`,
      name: (company?.company_name as string) ?? (m.company as string) ?? (m.name as string) ?? "Unnamed company",
      raiseLabel: company ? raiseLabel(company) : "Raise TBD",
      stage: company ? founderStage(score, (company.status as string | null) ?? "draft") : "onboard",
      readiness: { score, scoreKind: company ? "crr" : "lead_prescore" },
      plan: "—",
      ownerInitials: initials((m.owner as string) ?? (m.name as string) ?? null),
      lastActivity: String(m.synced_at ?? new Date().toISOString()),
      details: contactDetails(m),
    };
  });
  return stage ? records.filter((r) => r.stage === stage) : records;
}

export async function loadFounderRecords(
  opts: { stage?: FounderStage; limit?: number } = {},
): Promise<FounderRecord[]> {
  const mirror = await loadMirror("founder", opts.limit ?? 200).catch(() => []);
  if (mirror.length > 0) return foundersFromMirror(mirror, opts.stage);

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

/** Build investor records from mirrored contacts, enriched with profile intelligence where linked. */
async function investorsFromMirror(
  mirror: Record<string, unknown>[],
  opts: { kyc?: InvestorRecord["kyc"]; rel?: InvestorRel },
): Promise<InvestorRecord[]> {
  const supabase = createServiceRoleClient();
  const profileIds = mirror.map((m) => m.supabase_profile_id).filter(Boolean) as string[];
  const profByPid = new Map<string, Record<string, unknown>>();
  const pipelineCount = new Map<string, number>();
  if (profileIds.length) {
    const [{ data: profs }, { data: pipelines }] = await Promise.all([
      raw(supabase).from("investor_profiles").select("*").in("profile_id", profileIds),
      raw(supabase).from("investor_pipeline").select("investor_id").in("investor_id", profileIds),
    ]);
    for (const p of (profs ?? []) as Record<string, unknown>[]) profByPid.set(String(p.profile_id), p);
    for (const p of (pipelines ?? []) as { investor_id: string }[]) {
      pipelineCount.set(p.investor_id, (pipelineCount.get(p.investor_id) ?? 0) + 1);
    }
  }
  const records = mirror.map((m): InvestorRecord => {
    const pid = m.supabase_profile_id ? String(m.supabase_profile_id) : "";
    const prof = pid ? profByPid.get(pid) : undefined;
    const count = pid ? pipelineCount.get(pid) ?? 0 : 0;
    const oprof = odooProfile(m);
    // Odoo-derived fit proxy when there's no Supabase investor profile.
    const odooFit = oprof
      ? Math.min(100, 30 + asList(oprof.investorTypes).length * 20 + asList(oprof.industries).length * 5 + asList(oprof.capital).length * 5)
      : 0;
    const fit = prof ? investorFit(prof) : odooFit;
    const kyc = prof ? investorKyc(prof) : "None";
    const odooKind = oprof ? asList(oprof.investorTypes)[0] : undefined;
    return {
      id: prof ? pid : `mirror:${m.external_id}`,
      name: (m.name as string) ?? (m.email as string) ?? "Unknown investor",
      kind: (prof?.investor_type as string) ?? odooKind ?? (m.company as string) ?? "Investor",
      fit,
      kyc,
      rel: investorRel(fit, kyc, count),
      mandate: prof ? mandate(prof) : oprof ? mandateFromProfile(oprof) : (m.company ? [String(m.company)] : []),
      indicatedCount: count,
      ownerInitials: initials((m.owner as string) ?? (m.name as string) ?? null),
      lastActivity: String(m.synced_at ?? new Date().toISOString()),
      details: contactDetails(m),
    };
  });
  let out = records;
  if (opts.kyc) out = out.filter((r) => r.kyc === opts.kyc);
  if (opts.rel) out = out.filter((r) => r.rel === opts.rel);
  return out;
}

export async function loadInvestorRecords(
  opts: { kyc?: InvestorRecord["kyc"]; rel?: InvestorRel; limit?: number } = {},
): Promise<InvestorRecord[]> {
  const mirror = await loadMirror("investor", opts.limit ?? 200).catch(() => []);
  if (mirror.length > 0) return investorsFromMirror(mirror, opts);

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

// ── Unclassified bucket ────────────────────────────────────────────────────

/** Mirrored contacts with no founder/investor membership (module = "unknown"). */
export async function loadUnclassifiedRecords(opts: { limit?: number } = {}): Promise<UnclassifiedRecord[]> {
  const supabase = createServiceRoleClient();
  const { data } = await raw(supabase)
    .from("crm_contacts")
    .select("external_id, name, email, company, plan, raw, synced_at")
    .eq("module", "unknown")
    .order("synced_at", { ascending: false })
    .limit(opts.limit ?? 300);

  return ((data ?? []) as Record<string, unknown>[]).map((m): UnclassifiedRecord => {
    const p = odooProfile(m);
    const signals: string[] = [];
    if (p) {
      signals.push(...asList(p.investorTypes).slice(0, 3));
      signals.push(...asList(p.industries).slice(0, 2));
      signals.push(...asList(p.capital).slice(0, 1));
    }
    return {
      id: `mirror:${m.external_id}`,
      name: (m.name as string) ?? (m.email as string) ?? "Unnamed contact",
      email: (m.email as string) ?? null,
      company: (m.company as string) ?? null,
      membership: p?.membership ?? (m.plan as string) ?? null,
      signals,
      leadSource: p?.leadSource ?? null,
      lastActivity: String(m.synced_at ?? new Date().toISOString()),
    };
  });
}

export async function countUnclassified(): Promise<number> {
  const supabase = createServiceRoleClient();
  const { count } = await raw(supabase)
    .from("crm_contacts")
    .select("external_id", { count: "exact", head: true })
    .eq("module", "unknown");
  return count ?? 0;
}

// ── Match layer (platform-matching; indicated_interests deferred) ──────────────

export async function loadFounderMatches(companyId: string, limit = 8): Promise<MatchRow[]> {
  if (companyId.startsWith("mirror:")) return []; // un-linked lead — no company to match yet
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
  if (investorId.startsWith("mirror:")) return []; // un-linked lead — no profile to match yet
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
