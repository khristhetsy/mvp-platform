import { describe, expect, it } from "vitest";
import { renderInvoiceEmail, renderReceiptEmail } from "@/lib/accounting/emails";
import { EMPTY_WIRE_INSTRUCTIONS } from "@/lib/billing/wire-core";
import type { Customer, Invoice } from "@/lib/accounting/core";

const customer: Customer = {
  id: "c1", entity: "icfo_capital_global", contact_name: "Nazneen Dewji", company: "Cenna Biosciences", email: "n@example.com",
  phone: null, address: null, crm_contact_id: null, notes: null, archived: false, created_at: "2026-10-09T00:00:00Z",
};
const invoice: Invoice = {
  id: "i1", entity: "icfo_capital_global", invoice_number: "INV-2026-0007", customer_id: "c1", status: "sent",
  issue_date: "2026-11-01", due_date: "2026-11-16", currency: "USD", total_cents: 200000, amount_paid_cents: 0, memo: null,
  series_id: "s", series_index: 1, series_count: 4, public_token: "t", sent_at: null, last_emailed_to: null, paid_at: null, voided_at: null,
  created_at: "2026-10-09T00:00:00Z",
};
const instructions = { ...EMPTY_WIRE_INSTRUCTIONS, bank_name: "Bank of America", account_number: "000123", routing_number: "026009593" };

describe("accounting emails", () => {
  it("renders the invoice with the schedule and bank details", () => {
    const series = [1, 2, 3, 4].map((n) => ({ invoice_number: `INV-2026-000${6 + n}`, issue_date: `2026-${String(10 + n).padStart(2, "0")}-01`.replace("2026-13", "2027-01").replace("2026-14", "2027-02"), due_date: "2026-11-16", total_cents: 200000, status: "sent" as const }));
    const e = renderInvoiceEmail({ invoice, lines: [{ position: 0, description: "Advisory services, month 1 of 4", quantity: 1, unit_cents: 200000, amount_cents: 200000 }], customer, instructions, pdfUrl: "https://icapos.com/x", series });
    expect(e.subject).toBe("Invoice INV-2026-0007 from iCFO Capital Global, Inc., $2,000.00 due Nov 16, 2026");
    expect(e.text).toContain("Hi Nazneen,");
    expect(e.text).toContain("Payment schedule");
    expect(e.text).toContain("Bank name: Bank of America");
    expect(e.text).toContain("Reference: INV-2026-0007");
    expect(e.html).not.toContain(" — ");
  });
  it("says details are coming when no bank details are saved", () => {
    const e = renderInvoiceEmail({ invoice, lines: [], customer, instructions: EMPTY_WIRE_INSTRUCTIONS, pdfUrl: "https://icapos.com/x" });
    expect(e.text).toContain("Bank transfer details are on their way");
  });
  it("renders a receipt", () => {
    const e = renderReceiptEmail({ invoice: { ...invoice, status: "paid", amount_paid_cents: 200000 }, customer, amountCents: 200000, paidOn: "2026-11-09", pdfUrl: "https://icapos.com/x" });
    expect(e.subject).toBe("Payment received for invoice INV-2026-0007");
    expect(e.text).toContain("Balance: $0.00");
  });
});
