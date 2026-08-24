import { describe, it, expect, vi } from "vitest";
import { parseDailyIndex, primaryDocUrl, dailyIndexUrl, requireUserAgent, secFetch, ingestDay, recomputeUnpromoted, type FetchResult } from "./ingest";
import type { FormDFiling } from "./types";

const INDEX = `Description:           Daily Index of EDGAR Dissemination Feed
Last Data Received:    August 20, 2025

Form Type   Company Name                     CIK        Date Filed  File Name
---------------------------------------------------------------------------------
D           ACME ROBOTICS INC                0001234567 2025-08-20  edgar/data/1234567/0001234567-25-000001.txt
D/A         BETA CAPITAL LP                  0007654321 2025-08-20  edgar/data/7654321/0007654321-25-000002.txt
S-1         SOME OTHER CO                    0009999999 2025-08-20  edgar/data/9999999/0009999999-25-000003.txt
`;

describe("parseDailyIndex", () => {
  it("keeps only D / D-A and derives cik + accession + url", () => {
    const rows = parseDailyIndex(INDEX);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      formType: "D",
      companyName: "ACME ROBOTICS INC",
      cik: "1234567",
      dateFiled: "2025-08-20",
      accessionNo: "0001234567-25-000001",
      primaryDocUrl: "https://www.sec.gov/Archives/edgar/data/1234567/000123456725000001/primary_doc.xml",
    });
    expect(rows[1].formType).toBe("D/A");
  });
});

describe("urls", () => {
  it("primaryDocUrl strips dashes from the accession", () => {
    expect(primaryDocUrl("1234567", "0001234567-25-000001")).toBe("https://www.sec.gov/Archives/edgar/data/1234567/000123456725000001/primary_doc.xml");
  });
  it("dailyIndexUrl uses the right quarter", () => {
    expect(dailyIndexUrl(new Date("2025-08-20T00:00:00Z"))).toBe("https://www.sec.gov/Archives/edgar/daily-index/2025/QTR3/form.20250820.idx");
  });
});

describe("requireUserAgent (§4.4 / acceptance §13.5)", () => {
  it("throws when SEC_USER_AGENT is unset", () => {
    expect(() => requireUserAgent({})).toThrow(/SEC_USER_AGENT/);
  });
  it("returns the value when set", () => {
    expect(requireUserAgent({ SEC_USER_AGENT: "iCFO x@y.com" })).toBe("iCFO x@y.com");
  });
});

describe("secFetch", () => {
  it("returns 404 as a normal result (post-acceptance correction, not an error)", async () => {
    const f = vi.fn(async () => ({ status: 404, text: "" }) as FetchResult);
    const r = await secFetch(f, "u", "ua");
    expect(r.status).toBe(404);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("retries 503 then succeeds", async () => {
    let n = 0;
    const f = vi.fn(async () => (++n < 2 ? { status: 503, text: "" } : { status: 200, text: "ok" }) as FetchResult);
    const r = await secFetch(f, "u", "ua");
    expect(r.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("throws after exhausting retries", async () => {
    const f = vi.fn(async () => ({ status: 429, text: "" }) as FetchResult);
    await expect(secFetch(f, "u", "ua")).rejects.toThrow(/after 4 attempts/);
  });
});

describe("ingestDay", () => {
  const DOC = `<edgarSubmission><submissionType>D</submissionType><primaryIssuer><cik>1234567</cik><entityName>Acme</entityName></primaryIssuer><offeringData><offeringSalesAmounts><totalRemaining>7000000</totalRemaining></offeringSalesAmounts></offeringData></edgarSubmission>`;

  it("fetches the index, parses each filing, scores, and upserts (idempotent)", async () => {
    const fetchImpl = vi.fn(async (url: string) => (url.endsWith(".idx") ? { status: 200, text: INDEX } : { status: 200, text: DOC }) as FetchResult);
    const upsert = vi.fn(async () => {});
    const r = await ingestDay(new Date("2025-08-20T00:00:00Z"), { fetchImpl, userAgent: "ua", upsert, reqPerSec: 1000 });
    expect(r.indexed).toBe(2);
    expect(r.upserted).toBe(2);
    expect(upsert).toHaveBeenCalledTimes(2);
    // scored payload flows through
    const call = upsert.mock.calls[0][0] as unknown as { formdScore: number; accessionNo: string };
    expect(typeof call.formdScore).toBe("number");
    expect(call.accessionNo).toBe("0001234567-25-000001");
  });

  it("tolerates a 404 index (federal holiday) without failing", async () => {
    const fetchImpl = vi.fn(async () => ({ status: 404, text: "" }) as FetchResult);
    const r = await ingestDay(new Date("2025-08-20T00:00:00Z"), { fetchImpl, userAgent: "ua", upsert: vi.fn(async () => {}), reqPerSec: 1000 });
    expect(r.indexed).toBe(0);
  });

  it("counts a 404 primary_doc as notFound, not a crash", async () => {
    const fetchImpl = vi.fn(async (url: string) => (url.endsWith(".idx") ? { status: 200, text: INDEX } : { status: 404, text: "" }) as FetchResult);
    const r = await ingestDay(new Date("2025-08-20T00:00:00Z"), { fetchImpl, userAgent: "ua", upsert: vi.fn(async () => {}), reqPerSec: 1000 });
    expect(r.notFound).toBe(2);
    expect(r.upserted).toBe(0);
  });
});

describe("recomputeUnpromoted (§4.7)", () => {
  it("refreshes staleness + rescores, surfacing a lead aging into the stall window", async () => {
    const base: FormDFiling = {
      accessionNo: "a", cik: "1", formType: "D", isAmendment: false, dateFiled: "2025-01-01",
      companyName: "Acme", phone: "512", street1: null, street2: null, city: null, state: null, zipCode: null,
      entityType: null, jurisdiction: null, yearOfInc: null, industry: null, isFund: false,
      revenueRange: null, exemptions: "06b", is506c: false, totalOffering: 3_000_000, totalSold: 300_000,
      totalRemaining: 2_700_000, pctSold: 10, minInvestment: 50_000, investorCount: 3,
      dateFirstSale: "2025-05-01", saleYetToOccur: false, daysSinceFirstSale: 10,
      hasPlacementAgent: false, placementAgents: null, salesCommission: null,
      signerName: null, signerTitle: null, relatedPersons: [], filingUrl: null,
    };
    const updates: Record<string, number | null> = {};
    await recomputeUnpromoted({
      loadUnpromoted: async () => [base],
      update: async (acc, patch) => { updates[acc] = patch.daysSinceFirstSale; },
      asOf: new Date("2025-09-01T00:00:00Z"),
    });
    expect(updates["a"]).toBe(123); // May 1 → Sep 1
  });
});
