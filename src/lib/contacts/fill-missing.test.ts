import { describe, it, expect } from "vitest";
import {
  companyDomainOf, siteHost, findLinkedin, countryFromPhone, contactItems, websiteTargets, websiteItems,
  metaDescription, linkedinFromHtml, parseReading, robotsBlocksAll, computeDefaults, guessItems, bucketOf,
  hasField, fieldDef, defaultGuessFields, isWeakIndustryTag, type FillRow,
} from "./fill-missing";

const row = (o: Partial<FillRow> = {}): FillRow => ({
  id: o.id ?? "c1", name: o.name ?? "Jane Doe", company: o.company ?? "Acme", email: o.email ?? null,
  phone: o.phone ?? null, website: o.website ?? null, country: o.country ?? null,
  overrides: o.overrides ?? {}, profile: o.profile ?? { extra: {} },
});

describe("companyDomainOf", () => {
  it("returns the company domain", () => {
    expect(companyDomainOf("jane@Acme-Health.com")).toBe("acme-health.com");
    expect(companyDomainOf("x@mail.acme.co.uk")).toBe("acme.co.uk");
    expect(companyDomainOf("x@acme.mail.com")).toBe("acme.mail.com");
  });
  it("ignores free mail, our own domains and junk", () => {
    for (const e of ["a@gmail.com", "a@yahoo.co.uk", "a@hotmail.fr", "a@outlook.com", "a@icloud.com", "a@myicfos.com", "a@comcast.net", "a@mail.com", "a@yahoo.com.br", "nope", "", null]) {
      expect(companyDomainOf(e as string)).toBeNull();
    }
  });
});

describe("siteHost", () => {
  it("normalises and rejects social profiles", () => {
    expect(siteHost("https://www.acme.com/about")).toBe("acme.com");
    expect(siteHost("acme.io")).toBe("acme.io");
    expect(siteHost("https://www.linkedin.com/in/jane")).toBeNull();
    expect(siteHost("facebook.com/acme")).toBeNull();
    expect(siteHost("")).toBeNull();
  });
});

describe("findLinkedin", () => {
  it("finds and normalises a profile or company URL", () => {
    expect(findLinkedin("see http://www.linkedin.com/in/jane-doe/ now")).toBe("https://www.linkedin.com/in/jane-doe");
    expect(findLinkedin("{\"x\":\"https://linkedin.com/company/acme\"}")).toBe("https://linkedin.com/company/acme");
    expect(findLinkedin("https://www.linkedin.com/feed")).toBeNull();
  });
});

describe("countryFromPhone", () => {
  it("reads international numbers only", () => {
    expect(countryFromPhone("+44 20 7946 0958")).toBe("United Kingdom");
    expect(countryFromPhone("0033 1 23 45 67 89")).toBe("France");
    expect(countryFromPhone("+971 50 123 4567")).toBe("United Arab Emirates");
    expect(countryFromPhone("(858) 555-0100")).toBeNull();
  });
  it("splits the +1 zone and refuses Caribbean codes", () => {
    expect(countryFromPhone("+1 858 555 0100")).toBe("United States");
    expect(countryFromPhone("+1 416 555 0100")).toBe("Canada");
    expect(countryFromPhone("+1 876 555 0100")).toBeNull();
  });
});

describe("contactItems", () => {
  it("fills website, country and LinkedIn from the contact's own data", () => {
    const r = row({ email: "jane@acme.com", phone: "+49 30 123456", website: null, profile: { extra: { "Entrepreneur short bio": "https://www.linkedin.com/in/jane" } } });
    const items = contactItems(r, "founder");
    expect(items.map((i) => [i.field, i.values[0], i.tag])).toEqual([
      ["website", "https://acme.com", "derived:email"],
      ["country", "Germany", "derived:phone"],
      ["linkedin", "https://www.linkedin.com/in/jane", "derived:crm"],
    ]);
  });
  it("never replaces what the contact has", () => {
    const r = row({ email: "jane@acme.com", phone: "+49 30 123456", website: "acme.de", overrides: { country: "Austria", "Entrepreneur linkedin url": ["https://linkedin.com/in/x"] } });
    expect(contactItems(r, "founder")).toEqual([]);
  });
  it("uses a LinkedIn URL sitting in the website column", () => {
    const r = row({ website: "https://www.linkedin.com/in/charlie/" });
    expect(contactItems(r, "investor").map((i) => [i.key, i.values[0]])).toEqual([["Investor linkedin url", "https://www.linkedin.com/in/charlie"]]);
  });
});

describe("hasField", () => {
  it("counts stated values and overrides, and an emptied override as empty", () => {
    const f = fieldDef("founder", "summary")!;
    expect(hasField(row({ profile: { extra: { "Entrepreneur business summary": "We build X" } } }), f)).toBe(true);
    expect(hasField(row({ overrides: { "Entrepreneur business summary": ["We build X"] } }), f)).toBe(true);
    expect(hasField(row({ profile: { extra: { "Entrepreneur business summary": "We build X" } }, overrides: { "Entrepreneur business summary": [] } }), f)).toBe(false);
  });
});

describe("site parsing", () => {
  const html = `<html><head><meta property="og:description" content="Acme builds remote cardiac monitors for rural clinics &amp; hospitals."></head>
    <body><a href="https://twitter.com/acme">t</a><a href="https://www.linkedin.com/in/jane">j</a><a href='https://www.linkedin.com/company/acme/'>c</a></body></html>`;
  it("reads the description and prefers a company LinkedIn page", () => {
    expect(metaDescription(html)).toBe("Acme builds remote cardiac monitors for rural clinics & hospitals.");
    expect(linkedinFromHtml(html)).toBe("https://www.linkedin.com/company/acme");
  });
  it("rejects placeholder descriptions", () => {
    expect(metaDescription(`<meta name="description" content="This domain is for sale. Buy this domain today at a great price.">`)).toBeNull();
    expect(metaDescription(`<meta name="description" content="Short">`)).toBeNull();
  });
  it("respects a robots.txt that blocks everyone", () => {
    expect(robotsBlocksAll("User-agent: *\nDisallow: /\n")).toBe(true);
    expect(robotsBlocksAll("User-agent: *\nDisallow: /admin\n")).toBe(false);
    expect(robotsBlocksAll("User-agent: BadBot\nDisallow: /\nUser-agent: *\nAllow: /\n")).toBe(false);
  });
});

describe("parseReading", () => {
  const vocab = ["Healthcare", "HealthTech", "Software", "Fintech"];
  it("clamps industries to the vocabulary and bounds confidence", () => {
    const r = parseReading(`Sure: {"summary":"Remote monitoring.","industries":["healthtech","Space","Software"],"team":"Jane Doe (CEO)","confidence":140}`, vocab)!;
    expect(r.industries).toEqual(["HealthTech", "Software"]);
    expect(r.confidence).toBe(100);
    expect(r.team).toBe("Jane Doe (CEO)");
  });
  it("treats null-ish strings as empty and rejects non-JSON", () => {
    expect(parseReading(`{"summary":"n/a","industries":[],"team":null,"confidence":10}`, vocab)!.summary).toBeNull();
    expect(parseReading("no json here", vocab)).toBeNull();
  });
});

describe("websiteItems", () => {
  const site = { html: `<meta name="description" content="Acme builds remote cardiac monitors for rural clinics.">`, text: "x".repeat(300) };
  it("prefers the site's own description over the AI summary", () => {
    const r = row({ website: "acme.com" });
    const items = websiteItems(r, "founder", site, { summary: "AI summary", industries: ["HealthTech"], team: "Jane Doe (CEO)", confidence: 90 });
    expect(items.map((i) => [i.field, i.tag])).toEqual([["summary", "site:meta"], ["industry", "inferred:high"], ["team", "inferred:high"]]);
  });
  it("replaces a low industry guess only with a medium or better reading, keeping the old value", () => {
    const r = row({ website: "acme.com", overrides: { Industries: ["Software"], _industry_source: "inferred:low" } });
    expect(websiteTargets(r, "founder")).toContain("industry");
    const weak = websiteItems(r, "founder", site, { summary: null, industries: ["HealthTech"], team: null, confidence: 40 });
    expect(weak.find((i) => i.field === "industry")).toBeUndefined();
    const good = websiteItems(r, "founder", site, { summary: null, industries: ["HealthTech"], team: null, confidence: 70 }).find((i) => i.field === "industry")!;
    expect(good.previous).toEqual({ values: ["Software"], tag: "inferred:low" });
  });
  it("leaves a stated or reviewed industry alone", () => {
    expect(websiteTargets(row({ website: "acme.com", overrides: { Industries: ["Software"], _industry_source: "inferred:high" } }), "founder")).not.toContain("industry");
    expect(websiteTargets(row({ website: "acme.com", profile: { extra: {}, industries: ["Software"] } }), "founder")).not.toContain("industry");
    expect(isWeakIndustryTag("guess:default")).toBe(true);
    expect(isWeakIndustryTag("stated:pitchbook")).toBe(false);
  });
  it("has nothing to read without a site", () => {
    expect(websiteTargets(row({ email: "jane@gmail.com" }), "founder")).toEqual([]);
  });
});

describe("guess step", () => {
  const stated = (stage: string, entity: string) => row({ profile: { extra: { "Entrepreneur funding stage?": [stage], "Entrepreneur type(s) of business entity?": [entity] } } });
  const rows = [
    ...Array.from({ length: 24 }, () => stated("Seed", "LLC")),
    ...Array.from({ length: 8 }, () => stated("Seed", "C-Corp")),
    ...Array.from({ length: 10 }, () => stated("Series A", "C-Corp")),
  ];
  it("uses the same-stage majority, falling back to everyone", () => {
    const d = computeDefaults(rows, "founder");
    expect(d.seed.entity.values.map((v) => v.value)).toEqual(["LLC"]);
    expect(d["series a"]).toBeUndefined();          // 10 answers: below the sample floor
    expect(d["*"].entity.values.map((v) => v.value)).toEqual(["LLC"]);
    const seedless = row({ overrides: { "Entrepreneur funding stage?": ["Series A"] } });
    expect(bucketOf(seedless, "founder")).toBe("series a");
    expect(guessItems(seedless, "founder", d, ["entity"]).map((i) => [i.key, i.values, i.tag])).toEqual([["Entrepreneur type(s) of business entity?", ["LLC"], "guess:default"]]);
  });
  it("guesses only switched-on fields the contact lacks", () => {
    const d = computeDefaults(rows, "founder");
    expect(guessItems(stated("Seed", "C-Corp"), "founder", d, ["entity"])).toEqual([]);
    expect(guessItems(row(), "founder", d, [])).toEqual([]);
  });
  it("has revenue and ARR guesses off by default", () => {
    expect(defaultGuessFields("founder")).not.toContain("revenue");
    expect(defaultGuessFields("founder")).not.toContain("arr");
    expect(defaultGuessFields("investor")).not.toContain("size");
    expect(defaultGuessFields("founder")).toContain("entity");
  });
});
