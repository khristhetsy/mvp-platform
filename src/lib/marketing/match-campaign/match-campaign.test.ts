import { describe, expect, it } from "vitest";
import { canonicalStages, checkFounder, founderCompanyProfile, isEuCountry } from "./fields";
import { campaignInvestorFromRow, checkBandLabel, networkLabel } from "./investors";
import { matchFounder } from "./matcher";
import { makeFounderToken, verifyFounderToken } from "./token";
import { renderFounderEmail, renderSubject, MASK } from "./email";
import { readMatchConfig } from "./types";
import type { FounderFieldsRow } from "./types";

const founder = (over: Partial<FounderFieldsRow> = {}): FounderFieldsRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Ada Founder",
  email: "ada@ledgerline.io",
  email_status: "valid",
  suppressed: false,
  company: "Ledgerline",
  country: "United States",
  industries: ["Fintech"],
  funding_stages: ["Seed Round"],
  seeking_amount: [],
  seeking_investor_types: [],
  supabase_profile_id: null,
  pipeline_stage: null,
  founder_type: "lead",
  ...over,
});

const investor = (id: string, industries: string[], stages: string[], extra: Record<string, unknown> = {}) =>
  campaignInvestorFromRow({ id, profile: { industries, fundingStages: stages, investorTypes: ["Venture Capital"], extra }, overrides: null });

describe("data check", () => {
  const opts = { verifiedOnly: true, excludeEu: true, unsubscribed: false };
  it("passes a founder with industry, stage and a verified email", () => {
    expect(checkFounder(founder(), opts)).toBeNull();
  });
  it("excludes missing data before email problems", () => {
    expect(checkFounder(founder({ industries: [], email: null }), opts)).toBe("missing_industry");
    expect(checkFounder(founder({ funding_stages: ["Other"] }), opts)).toBe("missing_stage");
  });
  it("excludes unusable, suppressed, unverified and EU founders", () => {
    expect(checkFounder(founder({ email: "" }), opts)).toBe("no_email");
    expect(checkFounder(founder({ email: "not an email" }), opts)).toBe("invalid_email");
    expect(checkFounder(founder({ email_status: "invalid" }), opts)).toBe("invalid_email");
    expect(checkFounder(founder(), { ...opts, unsubscribed: true })).toBe("suppressed");
    expect(checkFounder(founder({ email_status: "unverified" }), opts)).toBe("email_unverified");
    expect(checkFounder(founder({ email_status: "unverified" }), { ...opts, verifiedOnly: false })).toBeNull();
    expect(checkFounder(founder({ country: "France" }), opts)).toBe("eu_excluded");
    expect(checkFounder(founder({ country: "France" }), { ...opts, excludeEu: false })).toBeNull();
  });
  it("holds back low-confidence industry and guessed stage unless included", () => {
    expect(checkFounder(founder({ industry_source: "inferred:low" }), opts)).toBe("unconfirmed_data");
    expect(checkFounder(founder({ stage_source: "guess:default" }), opts)).toBe("unconfirmed_data");
    expect(checkFounder(founder({ industry_source: "inferred:high", stage_source: "crm:extra" }), opts)).toBeNull();
    expect(checkFounder(founder({ stage_source: "guess:default" }), { ...opts, includeInferred: true })).toBeNull();
  });
  it("knows EU and GDPR-equivalent countries", () => {
    expect(isEuCountry("Germany")).toBe(true);
    expect(isEuCountry("United Kingdom")).toBe(true);
    expect(isEuCountry("United States")).toBe(false);
    expect(isEuCountry(null)).toBe(false);
  });
});

describe("stages", () => {
  it("keeps only the funding stage vocabulary, canonical and deduped", () => {
    expect(canonicalStages(["Seed Round", "seed", "Series A", "Other", "Acquired", "Pre-Seed"])).toEqual(["Seed Round", "Series A", "Pre-Seed"]);
  });
});

describe("matching", () => {
  const company = founderCompanyProfile(founder());
  it("matches only investors aligned on both industry and stage", () => {
    const pool = [
      investor("a", ["Fintech"], ["Seed Round", "Series A"]),
      investor("b", ["Fintech"], ["Series B"]), // stage miss
      investor("c", ["Healthcare"], ["Seed Round"]), // industry miss
      investor("d", [], ["Seed Round"]), // no sectors
    ];
    const m = matchFounder(company, pool);
    expect(m.map((x) => x.investor_contact_id)).toEqual(["a"]);
    expect(m[0].match_score).toBeGreaterThan(0);
    expect(m[0].match_score).toBeLessThanOrEqual(100);
  });
  it("does not let Pre-Seed match Seed Round by substring", () => {
    const m = matchFounder(founderCompanyProfile(founder({ funding_stages: ["Pre-Seed"] })), [investor("a", ["Fintech"], ["Seed Round"])]);
    expect(m).toHaveLength(0);
  });
  it("ranks a better check size fit higher", () => {
    const f = founderCompanyProfile(founder({ seeking_amount: ["$500k - $1m"] }));
    const m = matchFounder(f, [
      investor("far", ["Fintech"], ["Seed Round"], { "Investor investment size?": ["$10m - $50m"] }),
      investor("fit", ["Fintech"], ["Seed Round"], { "Investor investment size?": ["$500k - $1m"] }),
    ]);
    expect(m[0].investor_contact_id).toBe("fit");
  });
  it("never carries investor identity in the masked fields", () => {
    const [m] = matchFounder(company, [investor("a", ["Fintech"], ["Seed Round"])]);
    expect(Object.keys(m).sort()).toEqual(["check_band", "investor_contact_id", "investor_type", "match_score", "reasons", "sectors", "stages"]);
  });
});

describe("token", () => {
  it("round-trips and rejects tampering", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    const t = makeFounderToken(id);
    expect(verifyFounderToken(t)).toBe(id);
    expect(verifyFounderToken(t.slice(0, -1) + (t.endsWith("a") ? "b" : "a"))).toBeNull();
    const other = makeFounderToken("33333333-3333-4333-8333-333333333333");
    expect(verifyFounderToken(`${t.split(".")[0]}.${other.split(".")[1]}`)).toBeNull();
    expect(verifyFounderToken("garbage")).toBeNull();
    expect(verifyFounderToken(null)).toBeNull();
  });
});

describe("email", () => {
  const html = renderFounderEmail({
    company: "Ledgerline",
    industry: "Fintech",
    stages: ["Seed Round"],
    matchCount: 24,
    top: [
      { investor_type: "VC", sectors: ["Fintech"], stages: ["Seed Round", "Series A"], check_band: null, match_score: 92 },
      { investor_type: "Family office", sectors: ["Fintech", "SaaS"], stages: ["Seed Round"], check_band: null, match_score: 88 },
      { investor_type: "Angel", sectors: ["Fintech"], stages: ["Pre-Seed"], check_band: null, match_score: 81 },
    ],
    networkLabel: "7,000+",
    basicPrice: "$49/mo",
    links: { matches: "https://icapos.com/matches/t", call: "https://icapos.com/mc/t?a=call", plan: "https://icapos.com/mc/t?a=intro", privacy: "https://icapos.com/privacy" },
    postalAddress: "iCFO Capital Global, Inc., La Jolla, CA",
  });
  it("has the note, top 3 masked, see-all link and both buttons", () => {
    expect(html).toContain("7,000+ investors");
    expect(html).toContain("24 investors</strong> fit your industry and stage");
    expect(html.split(MASK).length - 1).toBe(3);
    expect(html).toContain("92% match");
    expect(html).toContain("21 more matches");
    expect(html).toContain("See all 24 matches");
    expect(html).toContain("Schedule a call with us");
    expect(html).toContain("Choose a plan to unlock");
    expect(html).toContain("Plans from $49/mo");
  });
  it("says match, never interested", () => {
    expect(html.toLowerCase()).not.toContain("interested");
  });
  it("fills the subject", () => {
    expect(renderSubject("{match_count} investors in our network match {company}", { matchCount: 24, company: "Ledgerline" })).toBe("24 investors in our network match Ledgerline");
  });
});

describe("helpers", () => {
  it("formats network and check bands", () => {
    expect(networkLabel(7245)).toBe("7,000+");
    expect(networkLabel(812)).toBe("812");
    expect(checkBandLabel(250_000, 1_000_000)).toBe("$250K to $1M");
    expect(checkBandLabel(null, null)).toBeNull();
  });
  it("reads config with safe defaults", () => {
    const c = readMatchConfig({ daily_cap: -3, dry_run: false });
    expect(c.daily_cap).toBe(150);
    expect(c.dry_run).toBe(false);
    expect(c.verified_only).toBe(true);
    expect(c.preview_count).toBe(3);
  });
});
