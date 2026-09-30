import { describe, expect, it } from "vitest";
import {
  excludedReason,
  founderToFitAnswers,
  fundingStageToQ1,
  networkLabel,
  fillSubject,
  readMatchConfig,
  sourceTag,
  usesGuessedValue,
  type FounderFields,
} from "./core";
import { renderMatchEmail } from "./email";
import { makeMatchToken, verifyMatchToken } from "./token";

const base: FounderFields = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Ada Lovelace",
  email: "ada@ledgerline.io",
  email_status: "unverified",
  suppressed: false,
  company: "Ledgerline",
  country: "United States",
  industries: ["Fintech"],
  funding_stages: ["Pre-Seed"],
  seeking_amount: ["$500k - $1m"],
  seeking_investor_types: ["Angel Investor"],
  supabase_profile_id: null,
  pipeline_stage: null,
  founder_type: "lead",
  industry_source: "inferred:low",
  stage_source: "guess:default",
};
const cfg = readMatchConfig({});

describe("use all values", () => {
  it("treats guessed and low confidence founders as ready", () => {
    expect(excludedReason(base, cfg)).toBeNull();
    expect(usesGuessedValue(base)).toBe(true);
  });
  it("excludes only for missing data, email, suppression and EU", () => {
    expect(excludedReason({ ...base, industries: [] }, cfg)).toBe("missing_industry");
    expect(excludedReason({ ...base, funding_stages: [] }, cfg)).toBe("missing_stage");
    expect(excludedReason({ ...base, email: "" }, cfg)).toBe("no_email");
    expect(excludedReason({ ...base, email: "not-an-email" }, cfg)).toBe("invalid_email");
    expect(excludedReason({ ...base, email_status: "invalid" }, cfg)).toBe("invalid_email");
    expect(excludedReason({ ...base, suppressed: true }, cfg)).toBe("suppressed");
    expect(excludedReason(base, cfg, true)).toBe("suppressed");
    expect(excludedReason({ ...base, country: "France" }, cfg)).toBe("eu_excluded");
    expect(excludedReason({ ...base, country: "France" }, { ...cfg, exclude_eu: false })).toBeNull();
  });
  it("unverified email is ready unless verified only is on", () => {
    expect(excludedReason(base, cfg)).toBeNull();
    expect(excludedReason(base, { ...cfg, verified_only: true })).toBe("email_unverified");
  });
  it("a source is left out only when the admin chooses it", () => {
    expect(excludedReason(base, { ...cfg, exclude_sources: ["low"] })).toBe("unconfirmed_data");
    expect(excludedReason({ ...base, industry_source: null, stage_source: "crm:extra" }, { ...cfg, exclude_sources: ["low", "guess"] })).toBeNull();
  });
});

describe("source tags", () => {
  it("maps stored provenance to display tags", () => {
    expect(sourceTag(null)).toMatchObject({ key: "crm", label: "CRM" });
    expect(sourceTag("crm:extra").key).toBe("crm");
    expect(sourceTag("inferred:high").label).toBe("High");
    expect(sourceTag("inferred:low")).toMatchObject({ label: "Low", tone: "bad" });
    expect(sourceTag("derived:summary").label).toBe("Summary");
    expect(sourceTag("guess:default").label).toBe("Guess");
  });
});

describe("founder to /fit answers", () => {
  it("prefers the operating stage, then the funding stage", () => {
    expect(founderToFitAnswers(base, { operatingStages: ["Startup"], revenue: [] }).stage).toEqual(["pre_revenue"]);
    expect(founderToFitAnswers(base, { operatingStages: [], revenue: [] }).stage).toEqual(["pre_revenue"]);
    expect(fundingStageToQ1("Series A")).toBe("revenue_pre_a");
    expect(fundingStageToQ1("Growth")).toBe("series_a_plus");
  });
  it("maps raise, revenue and investor type", () => {
    const a = founderToFitAnswers(base, { operatingStages: [], revenue: ["Pre-revenue"] });
    expect(a.industry).toEqual(["Fintech"]);
    expect(a.raise).toEqual(["under_1m"]);
    expect(a.revenue).toEqual(["pre_revenue"]);
    expect(a.investorType).toEqual(["angel"]);
    expect(founderToFitAnswers({ ...base, seeking_investor_types: [] }, { operatingStages: [], revenue: [] }).investorType).toEqual(["any"]);
    expect(founderToFitAnswers({ ...base, seeking_amount: ["$10m - $50m"] }, { operatingStages: [], revenue: ["$1M – $5M"] })).toMatchObject({ raise: ["over_10m"], revenue: ["1m_5m"] });
  });
});

describe("email", () => {
  it("rounds the network down and fills the subject", () => {
    expect(networkLabel(7245)).toBe("7,000+");
    expect(fillSubject("{match_count} investors in our network match {company}", { match_count: 24, company: "Ledgerline" })).toBe("24 investors in our network match Ledgerline");
  });
  it("says match, never interested, and hides names", () => {
    const r = renderMatchEmail({
      firstName: "Ada", company: "Ledgerline", industry: "Fintech", stage: "Seed", matchCount: 24, networkLabel: "7,000+",
      top: [{ investor_type: "VC", sectors: ["Fintech"], stages: ["Startup"], check_band: "$500k - $1m", fit: 92 }],
      subjectTemplate: "{match_count} investors in our network match {company}",
      pageUrl: "https://icapos.com/matches/t", callUrl: "https://icapos.com/mc/t?a=call", introUrl: "https://icapos.com/mc/t?a=intro",
    });
    expect(r.subject).toBe("24 investors in our network match Ledgerline");
    expect(r.text).toContain("Schedule a call with us");
    expect(r.text).toContain("Get introduced today");
    expect(r.text).toContain("23 more matches");
    expect(r.text).toContain("Name hidden");
    expect(`${r.text} ${r.html}`.toLowerCase()).not.toContain("interested");
  });
});

describe("token", () => {
  it("round trips and rejects tampering", () => {
    const t = makeMatchToken(base.id);
    expect(verifyMatchToken(t)).toBe(base.id);
    expect(verifyMatchToken(`${t}x`)).toBeNull();
    expect(verifyMatchToken("abc.def")).toBeNull();
  });
});
