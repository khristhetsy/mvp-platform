import { describe, expect, it } from "vitest";
import {
  activationPeriod, addMonths, daysOverdue, dueDateFor, invoiceAmountCents, needsRenewalInvoice,
  normalizeWireInstructions, periodEnd, shouldPausePremium, statusFor, wireInstructionRows, wireInstructionsComplete,
  WIRE_COPY,
} from "@/lib/billing/wire-core";
import { renderWireInvoiceEmail, renderWirePausedEmail, renderWireReceiptEmail } from "@/lib/billing/wire-emails";

const iso = (s: string) => new Date(s).toISOString();

describe("invoiceAmountCents", () => {
  it("is $1,000 monthly and $3,000 quarterly with no discount", () => {
    expect(invoiceAmountCents("monthly")).toBe(100000);
    expect(invoiceAmountCents("quarterly")).toBe(300000);
  });
  it("follows the catalogue's monthly price", () => {
    expect(invoiceAmountCents("quarterly", 120000)).toBe(360000);
  });
});

describe("periodEnd", () => {
  it("adds one or three calendar months", () => {
    expect(periodEnd("2026-10-09T17:00:00Z", "monthly").toISOString()).toBe(iso("2026-11-09T17:00:00Z"));
    expect(periodEnd("2026-10-09T17:00:00Z", "quarterly").toISOString()).toBe(iso("2027-01-09T17:00:00Z"));
  });
  it("clamps to the end of a shorter month", () => {
    expect(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString()).toBe(iso("2026-02-28T00:00:00Z"));
    expect(addMonths(new Date("2027-11-30T00:00:00Z"), 3).toISOString()).toBe(iso("2028-02-29T00:00:00Z"));
  });
});

describe("due date, status and days overdue", () => {
  const inv = { status: "awaiting", due_at: dueDateFor("2026-10-01T12:00:00Z").toISOString() };
  it("is due 7 days after issue", () => {
    expect(inv.due_at).toBe(iso("2026-10-08T12:00:00Z"));
  });
  it("stays awaiting until the due date, then reads overdue", () => {
    expect(statusFor(inv, new Date("2026-10-08T11:00:00Z"))).toBe("awaiting");
    expect(statusFor(inv, new Date("2026-10-08T13:00:00Z"))).toBe("overdue");
  });
  it("never changes received or void", () => {
    expect(statusFor({ ...inv, status: "received" }, new Date("2027-01-01"))).toBe("received");
    expect(statusFor({ ...inv, status: "void" }, new Date("2027-01-01"))).toBe("void");
  });
  it("counts whole days past due, zero before or when settled", () => {
    expect(daysOverdue(inv, new Date("2026-10-07T00:00:00Z"))).toBe(0);
    expect(daysOverdue(inv, new Date("2026-10-19T13:00:00Z"))).toBe(11);
    expect(daysOverdue({ ...inv, status: "received" }, new Date("2026-10-19T13:00:00Z"))).toBe(0);
  });
});

describe("needsRenewalInvoice", () => {
  const sub = { plan_type: "founder_premium", subscription_status: "active", current_period_end: "2026-11-09T00:00:00Z" };
  it("issues 7 days before the period ends", () => {
    expect(needsRenewalInvoice(sub, false, new Date("2026-11-01T00:00:00Z"))).toBe(false);
    expect(needsRenewalInvoice(sub, false, new Date("2026-11-02T00:00:00Z"))).toBe(true);
  });
  it("skips when an invoice is already open or the founder is not active Premium", () => {
    expect(needsRenewalInvoice(sub, true, new Date("2026-11-05"))).toBe(false);
    expect(needsRenewalInvoice({ ...sub, plan_type: "founder_basic" }, false, new Date("2026-11-05"))).toBe(false);
    expect(needsRenewalInvoice({ ...sub, subscription_status: "expired" }, false, new Date("2026-11-05"))).toBe(false);
  });
});

describe("shouldPausePremium", () => {
  const inv = { status: "overdue", due_at: "2026-11-09T00:00:00Z" };
  const sub = { plan_type: "founder_premium", subscription_status: "active", current_period_end: "2026-11-09T00:00:00Z" };
  it("pauses only after more than 10 days overdue and the period has ended", () => {
    expect(shouldPausePremium(inv, sub, new Date("2026-11-19T00:00:00Z"))).toBe(false);
    expect(shouldPausePremium(inv, sub, new Date("2026-11-20T01:00:00Z"))).toBe(true);
    expect(shouldPausePremium(inv, { ...sub, current_period_end: "2026-12-31T00:00:00Z" }, new Date("2026-11-21"))).toBe(false);
  });
  it("leaves a founder who moved off Premium, or was never activated, alone", () => {
    expect(shouldPausePremium(inv, { ...sub, plan_type: "founder_professional" }, new Date("2026-12-01"))).toBe(false);
    expect(shouldPausePremium(inv, { ...sub, subscription_status: "pending_payment" }, new Date("2026-12-01"))).toBe(false);
    expect(shouldPausePremium(inv, null, new Date("2026-12-01"))).toBe(false);
  });
});

describe("activationPeriod", () => {
  const base = { billing_cycle: "monthly" as const, period_start: "2026-10-09T00:00:00Z", issued_at: "2026-10-09T00:00:00Z" };
  it("starts a first payment on the day the wire arrives", () => {
    const p = activationPeriod({ ...base, is_renewal: false }, new Date("2026-10-12T00:00:00Z"));
    expect(p.start.toISOString()).toBe(iso("2026-10-12T00:00:00Z"));
    expect(p.end.toISOString()).toBe(iso("2026-11-12T00:00:00Z"));
  });
  it("continues a renewal from the period it renews", () => {
    const p = activationPeriod({ ...base, is_renewal: true }, new Date("2026-10-12T00:00:00Z"));
    expect(p.start.toISOString()).toBe(iso("2026-10-09T00:00:00Z"));
  });
});

describe("wire instructions", () => {
  it("defaults the beneficiary and never invents bank details", () => {
    const i = normalizeWireInstructions({});
    expect(i.beneficiary).toBe("iCFO Capital Global, Inc.");
    expect(i.account_number).toBe("");
    expect(wireInstructionsComplete(i)).toBe(false);
  });
  it("is complete with a bank, an account and a routing or SWIFT code", () => {
    const i = normalizeWireInstructions({ bank_name: " Bank ", account_number: "123", swift: "ABCDUS33" });
    expect(i.bank_name).toBe("Bank");
    expect(wireInstructionsComplete(i)).toBe(true);
    expect(wireInstructionRows(i).map((r) => r.label)).toEqual(["Beneficiary", "Bank name", "SWIFT / BIC", "Account number"]);
  });
});

describe("founder emails", () => {
  const invoice = {
    invoice_number: "INV 2026 0001", billing_cycle: "quarterly" as const, amount_cents: 300000,
    issued_at: "2026-10-09T17:00:00Z", due_at: "2026-10-16T17:00:00Z",
    period_start: "2026-10-09T17:00:00Z", period_end: "2027-01-09T17:00:00Z",
  };
  const instructions = normalizeWireInstructions({ bank_name: "Example Bank", account_number: "000", routing_number: "111" });

  it("carries the amount, the reference line, the disclaimer and no sentence dashes", () => {
    const e = renderWireInvoiceEmail({ firstName: "Ana", invoice, instructions, billingUrl: "https://x/billing", pdfUrl: "https://x/pdf", isRenewal: false });
    expect(e.subject).toContain("INV 2026 0001");
    expect(e.text).toContain("$3,000.00 USD");
    expect(e.text).toContain(WIRE_COPY.reference);
    expect(e.text).toContain("Reference: INV 2026 0001");
    expect(e.text).toContain(WIRE_COPY.disclaimer);
    expect(e.text).not.toMatch(/ [—–-] /);
  });

  it("renders the receipt and pause notice", () => {
    const r = renderWireReceiptEmail({ firstName: null, invoice, periodStart: invoice.period_start, periodEnd: invoice.period_end, dashboardUrl: "https://x", pdfUrl: "https://x/pdf" });
    expect(r.text).toContain("Premium is active from");
    const p = renderWirePausedEmail({ firstName: null, invoice, billingUrl: "https://x/billing" });
    expect(p.text).toContain("Premium resumes as soon as your wire is received");
  });
});
