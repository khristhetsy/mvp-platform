import { describe, expect, it } from "vitest";
import { formatPhone, formatPhoneAsYouType, isValidPhone, normalizePhone, phoneDialString, smsHref, telHref } from "./index";

describe("normalizePhone (store)", () => {
  it("turns US shapes into E.164", () => {
    for (const v of ["4255022832", "(425) 502-2832", "425.502.2832", "425-502-2832", "1-425-502-2832", "+1 425 502 2832"]) {
      expect(normalizePhone(v)).toBe("+14255022832");
    }
  });
  it("handles international and 00 prefix", () => {
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhone("0033 1 23 45 67 89")).toBe("+33123456789");
    expect(normalizePhone("+52 55 1234 5678")).toBe("+525512345678");
  });
  it("keeps extensions", () => {
    expect(normalizePhone("312-346-1006 ext. 1")).toBe("+13123461006 ext. 1");
    expect(normalizePhone("312-346-1006 x22")).toBe("+13123461006 ext. 22");
  });
  it("rejects junk and short numbers", () => {
    expect(normalizePhone("555-0100")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe("formatPhone (display)", () => {
  it("US and Canada use national format", () => {
    expect(formatPhone("4255022832")).toBe("(425) 502-2832");
    expect(formatPhone("+14255022832")).toBe("(425) 502-2832");
    expect(formatPhone("+13123461006 ext. 1")).toBe("(312) 346-1006 ext. 1");
  });
  it("others use international format", () => {
    expect(formatPhone("+442079460958")).toBe("+44 20 7946 0958");
    expect(formatPhone("+33123456789")).toBe("+33 1 23 45 67 89");
  });
  it("never destroys unparseable text", () => {
    expect(formatPhone("call after 5")).toBe("call after 5");
    expect(formatPhone("  ")).toBe("");
    expect(formatPhone(undefined)).toBe("");
  });
});

describe("dial helpers", () => {
  it("builds tel and sms from the stored value", () => {
    expect(telHref("(425) 502-2832")).toBe("tel:+14255022832");
    expect(smsHref("+14255022832")).toBe("sms:+14255022832");
    expect(phoneDialString("n/a")).toBeNull();
    expect(isValidPhone("4255022832")).toBe(true);
  });
});

describe("formatPhoneAsYouType", () => {
  it("formats US progressively", () => {
    expect(formatPhoneAsYouType("425")).toBe("425");
    expect(formatPhoneAsYouType("4255")).toBe("(425) 5");
    expect(formatPhoneAsYouType("4255022832")).toBe("(425) 502-2832");
    expect(formatPhoneAsYouType("+442079460958")).toBe("+44 20 7946 0958");
  });
});
