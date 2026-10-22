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

function valueOf(c: CompanyRow | null, key: WiredKey): string {
  if (!c) return "";
  switch (key) {
    case "company_name":
      return (c.company_name ?? "").trim();
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

export async function loadWired(orgId: string | null, excluded: string[]): Promise<WiredData> {
  const company = await loadCompany(orgId);
  return {
    companyId: company?.id ?? null,
    fields: WIRED_KEYS.map((key) => {
      const value = valueOf(company, key);
      const present = value.length > 0;
      return { key, label: LABELS[key], source: "Company profile", present, selected: present && !excluded.includes(key), preview: value.slice(0, 120) };
    }),
  };
}

/** The selected profile fields as plain lines for the agent's fact sheet. Empty when none are selected. */
export async function wiredFactSheet(orgId: string | null, excluded: string[]): Promise<string> {
  const company = await loadCompany(orgId);
  return WIRED_KEYS.filter((k) => !excluded.includes(k))
    .map((k) => ({ k, v: valueOf(company, k) }))
    .filter((x) => x.v)
    .map((x) => `${LABELS[x.k]}: ${x.v.slice(0, 1500)}`)
    .join("\n");
}
