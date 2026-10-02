import { describe, it, expect } from "vitest";
import { FIT_BOOKING_FORM_DEFAULTS, MAX_FIT_QUESTIONS, resolveFitBookingForm } from "./booking-form-config";

describe("resolveFitBookingForm", () => {
  it("returns the defaults for null or junk", () => {
    expect(resolveFitBookingForm(null)).toEqual(FIT_BOOKING_FORM_DEFAULTS);
    expect(resolveFitBookingForm("nope")).toEqual(FIT_BOOKING_FORM_DEFAULTS);
  });

  it("defaults to phone shown but optional, and no questions", () => {
    const f = resolveFitBookingForm({});
    expect(f.contactFields.phone).toEqual({ label: "Phone", collect: true, required: false });
    expect(f.questions).toEqual([]);
  });

  it("keeps edited labels and flags, and never requires a field that is not collected", () => {
    const f = resolveFitBookingForm({ contactFields: {
      email: { label: "  Best email " },
      phone: { label: "Mobile", collect: true, required: true },
      company: { label: "", collect: false, required: true },
    } });
    expect(f.contactFields.email.label).toBe("Best email");
    expect(f.contactFields.phone).toEqual({ label: "Mobile", collect: true, required: true });
    expect(f.contactFields.company).toEqual({ label: "Company", collect: false, required: false });
  });

  it("drops blank questions and choice questions without options, and trims options", () => {
    const f = resolveFitBookingForm({ questions: [
      { id: "a", label: " ", type: "short_text" },
      { id: "b", label: "Round", type: "single", options: [" ", ""] },
      { id: "c", label: "Raised so far", type: "single", options: [" Nothing ", "Nothing", "Over $1M"], required: true },
      { id: "d", label: "Anything else?", type: "weird" },
    ] });
    expect(f.questions).toEqual([
      { id: "c", label: "Raised so far", type: "single", options: ["Nothing", "Over $1M"], required: true },
      { id: "d", label: "Anything else?", type: "short_text", options: [], required: false },
    ]);
  });

  it("caps the number of questions", () => {
    const qs = Array.from({ length: 15 }, (_, i) => ({ id: `q${i}`, label: `Q${i}`, type: "short_text" }));
    expect(resolveFitBookingForm({ questions: qs }).questions).toHaveLength(MAX_FIT_QUESTIONS);
  });
});
