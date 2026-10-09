import { describe, expect, it } from "vitest";
import { cleanCsv, mapFundingStages, mapInvestorTypes, normalizeEmail, normalizeName, normalizePhone, parseCsv } from "@/lib/investor-directory/clean";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes and embedded commas", () => {
    expect(parseCsv('a,"b, c","d ""q"""\n1,2,3\n')).toEqual([["a", "b, c", 'd "q"'], ["1", "2", "3"]]);
  });
});

describe("normalizers", () => {
  it("cleans emails and flags bad ones", () => {
    expect(normalizeEmail(" Jane@Fund.COM ")).toEqual({ email: "jane@fund.com", invalid: false });
    expect(normalizeEmail("a@b.com; c@d.com").email).toBe("a@b.com");
    expect(normalizeEmail("not an email")).toEqual({ email: null, invalid: true });
    expect(normalizeEmail("")).toEqual({ email: null, invalid: false });
  });
  it("formats US phones and leaves others alone", () => {
    expect(normalizePhone("312-346-1006")).toBe("(312) 346-1006");
    expect(normalizePhone("(312) 750-0662 ext. 1")).toBe("(312) 750-0662 ext. 1");
    expect(normalizePhone("+44 20 7946 0000")).toBe("+44 20 7946 0000");
  });
  it("keeps acronyms, title-cases lower case, drops placeholders", () => {
    expect(normalizeName("LWO LLC")).toBe("LWO LLC");
    expect(normalizeName("st. louis")).toBe("St. Louis");
    expect(normalizeName("na")).toBeNull();
  });
  it("maps public labels onto platform slugs", () => {
    expect(mapInvestorTypes("Venture", null)).toEqual(["venture-capital"]);
    expect(mapInvestorTypes("Private Credit", null)).toEqual(["lender"]);
    expect(mapFundingStages("Early Venture", "Venture")).toEqual(["seed"]);
    expect(mapFundingStages("Mezzanine", "Hybrid")).toEqual([]);
  });
});

describe("cleanCsv", () => {
  it("maps headers, dedupes by email and counts problems", () => {
    const csv = [
      "Firm,Contact,Email,Phone,City,State,Strategy,Style,Investing Now",
      "Cultivation Capital,Brian Matthews,bmatthews@cultivationcapital.com,314-565-8062,St. Louis,MO,Early Venture,Venture,Yes",
      "Cultivation Capital,Brian Matthews,BMATTHEWS@cultivationcapital.com,,St. Louis,MO,Venture,Venture,No",
      "Bad Fund,Al,not-an-email,,,,,,",
      ",No Firm,x@y.com,,,,,,",
    ].join("\n");
    const r = cleanCsv(csv);
    expect(r.rowCount).toBe(4);
    expect(r.merged).toBe(1);
    expect(r.invalidEmails).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ firm: "Cultivation Capital", phone: "(314) 565-8062", investor_types: ["venture-capital"], investing_now: true });
    expect(r.rows[0].funding_stages).toEqual(expect.arrayContaining(["seed", "series-a"]));
  });
});
