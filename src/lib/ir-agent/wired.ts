import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

/**
 * Company profile fields that feed the IR agent. Text fields only: the agent
 * never states prices, percentages or funding figures, so the raise amount,
 * revenue figures and cap table are deliberately not wired.
 */
export const WIRED_KEYS = ["company_name", "business_summary", "sector_stage", "use_of_funds", "team"] as const;
export type WiredKey = (typeof WIRED_KEYS)[number];

const LABELS: Record<WiredKey, string> = {
  company_name: "Company name",
  business_summary: "Business summary",
  sector_stage: "Sector and stage",
  use_of_funds: "Use of funds",
  team: "Team and advisors",
};

type CompanyRow = {
  id: string;
  company_name: string | null;
  business_description: string | null;
  industry: string | null;
  revenue_stage: string | null;
  use_of_funds: string | null;
  team_summary: string | null;
};

export type WiredField = {
  key: WiredKey;
  label: string;
  source: "Company profile";
  /** The company profile has a value for this field. */
  present: boolean;
  /** Fed to the agent: present and not unticked. */
  selected: boolean;
  /** First part of the value, for the admin to recognize it. */
  preview: string;
};

export type WiredData = { companyId: string | null; fields: WiredField[] };

async function loadCompany(orgId: string | null): Promise<CompanyRow | null> {
  if (!orgId) return null;
  const { data } = await serviceRoleClientUntyped()
    .from("companies")
    .select("id, company_name, business_description, industry, revenue_stage, use_of_funds, team_summary")
    .eq("org_id", orgId)
    .limit(1)
    .maybeSingle();
  return (data as CompanyRow | null) ?? null;
}

function valueOf(c: CompanyRow | null, key: WiredKey, fallbackName = ""): string {
  if (key === "company_name") return (c?.company_name ?? "").trim() || fallbackName.trim();
  if (!c) return "";
  switch (key) {
    case "business_summary":
      return (c.business_description ?? "").trim();
    case "sector_stage":
      return [c.industry, c.revenue_stage].map((v) => (v ?? "").trim()).filter(Boolean).join(", ");
    case "use_of_funds":
      return (c.use_of_funds ?? "").trim();
    case "team":
      return (c.team_summary ?? "").trim();
  }
}

/** fallbackName is the agent's company name: known even when the company has no profile (a prospect from contacts). */
export async function loadWired(orgId: string | null, excluded: string[], fallbackName = ""): Promise<WiredData> {
  const company = await loadCompany(orgId);
  return {
    companyId: company?.id ?? null,
    fields: WIRED_KEYS.map((key) => {
      const value = valueOf(company, key, fallbackName);
      const present = value.length > 0;
      return { key, label: LABELS[key], source: "Company profile", present, selected: present && !excluded.includes(key), preview: value.slice(0, 120) };
    }),
  };
}

/** The selected profile fields as plain lines for the agent's fact sheet. Empty when none are selected. */
export async function wiredFactSheet(orgId: string | null, excluded: string[], fallbackName = ""): Promise<string> {
  const company = await loadCompany(orgId);
  return WIRED_KEYS.filter((k) => !excluded.includes(k))
    .map((k) => ({ k, v: valueOf(company, k, fallbackName) }))
    .filter((x) => x.v)
    .map((x) => `${LABELS[x.k]}: ${x.v.slice(0, 1500)}`)
    .join("\n");
}

/**
 * How many of the five profile fields each agent has selected (present and not
 * unticked), for the Agents list. One query for all agents.
 */
export async function wiredSelectedCounts(agents: Array<{ id: string; organization_id: string | null; wired_excluded?: string[] | null; company_name: string }>): Promise<Map<string, number>> {
  const orgIds = [...new Set(agents.map((a) => a.organization_id).filter((v): v is string => Boolean(v)))];
  const rows = new Map<string, CompanyRow>();
  if (orgIds.length) {
    const { data } = await serviceRoleClientUntyped()
      .from("companies")
      .select("id, org_id, company_name, business_description, industry, revenue_stage, use_of_funds, team_summary")
      .in("org_id", orgIds);
    for (const r of (data ?? []) as Array<CompanyRow & { org_id: string }>) if (!rows.has(r.org_id)) rows.set(r.org_id, r);
  }
  const out = new Map<string, number>();
  for (const a of agents) {
    const company = a.organization_id ? (rows.get(a.organization_id) ?? null) : null;
    const excluded = a.wired_excluded ?? [];
    out.set(a.id, WIRED_KEYS.filter((k) => !excluded.includes(k) && valueOf(company, k, a.company_name).length > 0).length);
  }
  return out;
}
