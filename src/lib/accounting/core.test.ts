import { describe, expect, it } from "vitest";
import {
  addMonthsDate, agingBucket, agingReport, balanceDue, displayStatus, parseBankCsv, parseMoneyToCents,
  autoMatch, canPay, parseOfx, payPagePath, plaidAmountToCents, seriesDates, seriesLineLabel, suggestMatch, todayPT, type MatchCandidate,
} from "@/lib/accounting/core";

const inv = (over: Partial<MatchCandidate> = {}): MatchCandidate => ({
  id: "a", invoice_number: "INV-2026-0002", customer_id: "c1", status: "sent",
  due_date: "2026-12-15", total_cents: 200000, amount_paid_cents: 0, customerLabel: "Cenna Biosciences", ...over,
});

describe("money and dates", () => {
  it("parses typed amounts", () => {
    expect(parseMoneyToCents("2,000")).toBe(200000);
    expect(parseMoneyToCents("$1,250.5")).toBe(125050);
    expect(parseMoneyToCents("abc")).toBeNull();
  });
  it("adds months without skipping a month", () => {
    expect(addMonthsDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsDate("2026-11-01", 3)).toBe("2027-02-01");
  });
  it("reads today in Pacific time", () => {
    // 2026-10-10 05:00 UTC is still Oct 9 in Los Angeles.
    expect(todayPT(new Date("2026-10-10T05:00:00Z"))).toBe("2026-10-09");
  });
});

describe("monthly series", () => {
  it("builds four monthly invoices with net 15", () => {
    const s = seriesDates("2026-11-01", 4, 15);
    expect(s.map((d) => d.issue_date)).toEqual(["2026-11-01", "2026-12-01", "2027-01-01", "2027-02-01"]);
    expect(s[1].due_date).toBe("2026-12-16");
    expect(seriesLineLabel("Advisory services", 2, 4)).toBe("Advisory services, month 2 of 4");
  });
});

describe("status and aging", () => {
  it("works out overdue and partly paid", () => {
    expect(displayStatus(inv(), "2026-12-20")).toBe("overdue");
    expect(displayStatus(inv({ amount_paid_cents: 50000 }), "2026-12-01")).toBe("partial");
    expect(displayStatus(inv({ status: "paid" }), "2027-01-01")).toBe("paid");
    expect(balanceDue(inv({ status: "void" }))).toBe(0);
  });
  it("buckets open balances by days late", () => {
    expect(agingBucket("2026-12-15", "2026-12-10")).toBe("Current");
    expect(agingBucket("2026-12-15", "2027-01-20")).toBe("31 to 60");
    const r = agingReport([inv(), inv({ id: "b", due_date: "2026-10-01" }), inv({ id: "c", status: "paid" })], () => "Cenna", "2026-12-20");
    expect(r.total).toBe(400000);
    expect(r.totals["1 to 30"]).toBe(200000);
    expect(r.totals["61 to 90"]).toBe(200000);
  });
});

describe("bank matching", () => {
  it("flips Plaid's sign so deposits are positive", () => {
    expect(plaidAmountToCents(-2000)).toBe(200000);
    expect(plaidAmountToCents(20)).toBe(-2000);
  });
  it("prefers the invoice number in the description", () => {
    const list = [inv({ id: "x", invoice_number: "INV-2026-0003", due_date: "2027-01-15" }), inv()];
    expect(suggestMatch({ amount_cents: 200000, description: "CENNA BIOSCIENCES ACH INV-2026-0002", merchant: null }, list)?.id).toBe("a");
  });
  it("falls back to the oldest invoice for that customer", () => {
    const list = [inv({ id: "x", invoice_number: "INV-2026-0003", due_date: "2027-01-15" }), inv()];
    expect(suggestMatch({ amount_cents: 200000, description: "ACH CREDIT CENNA BIOSCIENCES", merchant: null }, list)?.id).toBe("a");
  });
  it("leaves unclear or outgoing amounts for a person", () => {
    const list = [inv({ customerLabel: "Acme" }), inv({ id: "y", invoice_number: "INV-2026-0009", customerLabel: "Other Co" })];
    expect(suggestMatch({ amount_cents: 200000, description: "WIRE IN", merchant: null }, list)).toBeNull();
    expect(suggestMatch({ amount_cents: -200000, description: "INV-2026-0002", merchant: null }, list)).toBeNull();
    expect(suggestMatch({ amount_cents: 199999, description: "INV-2026-0002", merchant: null }, list)).toBeNull();
  });
  it("auto matches only on exact balance plus the invoice number", () => {
    const list = [inv({ id: "x", invoice_number: "INV-2026-0003" }), inv()];
    expect(autoMatch({ amount_cents: 200000, description: "ACH CREDIT CENNA INV 2026 0002", merchant: null }, list)?.id).toBe("a");
    expect(autoMatch({ amount_cents: 200000, description: "ACH CREDIT CENNA BIOSCIENCES", merchant: null }, list)).toBeNull();
    expect(autoMatch({ amount_cents: 150000, description: "INV-2026-0002", merchant: null }, list)).toBeNull();
    expect(autoMatch({ amount_cents: 200000, description: "INV-2026-0002", merchant: null }, [inv({ status: "paid" })])).toBeNull();
  });
  it("only offers deposits into the billing company's account, on or after the issue date", () => {
    const ivg = inv({ entity: "icfo_venture_group", issue_date: "2026-10-09", invoice_number: "IVG-2026-0002" });
    const transfer = { amount_cents: 200000, description: "Online Banking transfer from CHK 2522", merchant: null };
    expect(canPay({ ...transfer, posted_on: "2026-07-27", entity: "icfo_venture_group" }, ivg)).toBe(false);
    expect(canPay({ ...transfer, posted_on: "2026-10-12", entity: "icfo_capital_global" }, ivg)).toBe(false);
    expect(canPay({ ...transfer, posted_on: "2026-10-12", entity: "icfo_venture_group" }, ivg)).toBe(true);
    expect(suggestMatch({ ...transfer, posted_on: "2026-07-27", entity: "icfo_capital_global" }, [ivg])).toBeNull();
    expect(autoMatch({ amount_cents: 200000, description: "ACH IVG-2026-0002", merchant: null, posted_on: "2026-10-12", entity: "icfo_capital_global" }, [ivg])).toBeNull();
    expect(autoMatch({ amount_cents: 200000, description: "ACH IVG-2026-0002", merchant: null, posted_on: "2026-10-12", entity: "icfo_venture_group" }, [ivg])?.id).toBe("a");
  });
  it("builds the pay page link from the number and token", () => {
    expect(payPagePath({ invoice_number: "INV-2026-0001", public_token: "abc" })).toBe("/pay/inv-2026-0001?t=abc");
  });
});

describe("bank file imports", () => {
  it("reads a Bank of America CSV with summary lines on top", () => {
    const csv = [
      "Description,,Summary Amt.",
      "Beginning balance as of 12/01/2026,,\"46,230.55\"",
      "",
      "Date,Description,Amount,Running Bal.",
      "12/09/2026,\"CENNA BIOSCIENCES DES:ACH INV-2026-0002\",\"2,000.00\",\"48,230.55\"",
      "12/08/2026,\"VERCEL INC\",\"-20.00\",\"46,230.55\"",
    ].join("\n");
    const rows = parseBankCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ posted_on: "2026-12-09", amount_cents: 200000 });
    expect(rows[1].amount_cents).toBe(-2000);
    expect(parseBankCsv(csv)[0].external_id).toBe(rows[0].external_id);
  });
  it("reads QFX transactions", () => {
    const qfx = "<OFX><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261209120000<TRNAMT>2000.00<FITID>abc123<NAME>CENNA BIOSCIENCES</STMTTRN></OFX>";
    expect(parseOfx(qfx)).toEqual([{ external_id: "ofx-abc123", posted_on: "2026-12-09", description: "CENNA BIOSCIENCES", amount_cents: 200000 }]);
  });
});

describe("letterhead", () => {
  it("keeps a PNG logo and the address lines", async () => {
    const { normalizeLetterhead, letterheadLines } = await import("@/lib/accounting/core");
    const lh = normalizeLetterhead({ logo: "data:image/png;base64,iVBORw0KGgo=", address: " 4225 Executive Sq, Ste 600\nLa Jolla, CA 92037 ", phone: "", email: "billing@icfo.com" });
    expect(lh.logo).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(letterheadLines(lh)).toEqual(["4225 Executive Sq, Ste 600", "La Jolla, CA 92037", "billing@icfo.com"]);
  });
  it("falls back to the city and rejects other image types", async () => {
    const { normalizeLetterhead, letterheadLines, EMPTY_LETTERHEAD } = await import("@/lib/accounting/core");
    expect(letterheadLines(EMPTY_LETTERHEAD)).toEqual(["La Jolla, CA"]);
    expect(() => normalizeLetterhead({ logo: "data:image/svg+xml;base64,PHN2Zz4=" })).toThrow("PNG or JPG");
  });
  it("names the issuing company in the disclaimer", async () => {
    const { entityDisclaimer } = await import("@/lib/accounting/core");
    expect(entityDisclaimer("icfo_venture_group")).toBe("iCFO Venture Group does not solicit securities and is not an investment adviser.");
    expect(entityDisclaimer("icfo_capital_global")).toMatch(/^iCFO Capital does not/);
  });
});
