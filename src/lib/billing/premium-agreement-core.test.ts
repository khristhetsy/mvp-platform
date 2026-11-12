import { describe, expect, it } from "vitest";
import {
  AGREEMENT_TERMS,
  agreementDatePT,
  agreementValues,
  parseAgreementInput,
} from "./premium-agreement-core";

const good = {
  companyName: "Acme Robotics, Inc.",
  companyAddress: "1 Main St, Austin, TX 78701",
  companyEmail: "ceo@acme.com",
  acceptedName: "Jane Doe",
  acceptedTitle: "CEO",
};

describe("parseAgreementInput", () => {
  it("accepts complete input", () => {
    const r = parseAgreementInput(good);
    expect(r.ok).toBe(true);
  });

  it("rejects a missing field", () => {
    expect(parseAgreementInput({ ...good, acceptedTitle: " " }).ok).toBe(false);
  });

  it("rejects a bad email", () => {
    expect(parseAgreementInput({ ...good, companyEmail: "nope" }).ok).toBe(false);
  });

  it("strips template braces so a founder cannot inject a token", () => {
    const r = parseAgreementInput({ ...good, companyName: "Acme {{accepted_name}}" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.companyName).not.toContain("{{");
  });

  it("rejects non-objects", () => {
    expect(parseAgreementInput(null).ok).toBe(false);
  });
});

describe("agreementValues", () => {
  it("maps every field and dates in Pacific time", () => {
    const r = parseAgreementInput(good);
    if (!r.ok) throw new Error("setup");
    const v = agreementValues(r.value, "2026-11-12T03:00:00Z");
    expect(v.company_name).toBe("Acme Robotics, Inc.");
    expect(v.accepted_name).toBe("Jane Doe");
    expect(v.accepted_date).toBe("November 11, 2026");
    expect(v.icfo_notice_email).toBeTruthy();
  });

  it("agreementDatePT uses Pacific time", () => {
    expect(agreementDatePT("2026-11-12T20:00:00Z")).toBe("November 12, 2026");
  });
});

describe("AGREEMENT_TERMS", () => {
  it("states the agreed commercial terms", () => {
    const text = AGREEMENT_TERMS.map((t) => `${t.label} ${t.value}`).join(" | ");
    expect(text).toContain("$1,000");
    expect(text).toContain("Month to month");
    expect(text).toContain("None");
  });
});
