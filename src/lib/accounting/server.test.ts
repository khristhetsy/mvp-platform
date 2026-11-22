import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({}) }));
vi.mock("@/lib/email/send-email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/notifications/notifications", () => ({ notifyStaff: vi.fn() }));
vi.mock("@/lib/activity/email-templates", () => ({
  absoluteUrl: (p: string) => p,
  button: () => "",
  escapeHtml: (s: string) => s,
  shell: () => "",
}));
vi.mock("@/lib/billing/wire", () => ({ getWireInstructions: vi.fn(), saveWireInstructions: vi.fn() }));
vi.mock("@/lib/accounting/invoice-pdf", () => ({ renderInvoicePdf: vi.fn() }));
vi.mock("@/lib/accounting/plaid", () => ({ plaidConfigured: () => true }));

import { deletePayment, runAccountingDaily, syncAllBanks } from "./server";

type Call = { table: string; op: "select" | "update" | "delete"; payload?: unknown };
type Reply = { data?: unknown; error?: { message: string } | null };

/** A scripted stand-in for the Supabase client. Records every call in order. */
function fakeClient(handler: (call: Call) => Reply) {
  const log: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, op: "select" };
      const finish = () => {
        log.push({ ...call });
        const r = handler(call);
        return Promise.resolve({ data: r.data ?? null, error: r.error ?? null });
      };
      const chain: Record<string, unknown> = {
        select: () => chain,
        update: (payload: unknown) => ((call.op = "update"), (call.payload = payload), chain),
        delete: () => ((call.op = "delete"), chain),
        eq: () => chain,
        neq: () => chain,
        lte: () => chain,
        limit: () => chain,
        order: () => chain,
        maybeSingle: finish,
        single: finish,
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => finish().then(res, rej),
      };
      return chain;
    },
  };
  return { client, log };
}

const invoice = { id: "inv1", status: "paid", amount_paid_cents: 10000, total_cents: 10000, paid_at: "2026-11-01T20:00:00Z" };
const payment = { id: "pay1", invoice_id: "inv1", amount_cents: 4000, bank_transaction_id: "tx1" };

describe("deletePayment", () => {
  it("lowers the invoice, removes the payment, then resets the bank transaction", async () => {
    const { client, log } = fakeClient((c) => {
      if (c.table === "acct_payments" && c.op === "select") return { data: payment };
      if (c.table === "acct_invoices" && c.op === "select") return { data: invoice };
      if (c.table === "acct_invoices" && c.op === "update") return { data: { ...invoice, amount_paid_cents: 6000, status: "sent" } };
      return {};
    });
    const result = await deletePayment("pay1", client);
    expect(result).toMatchObject({ amount_paid_cents: 6000, status: "sent" });
    const writes = log.filter((c) => c.op !== "select").map((c) => `${c.table}:${c.op}`);
    expect(writes).toEqual(["acct_invoices:update", "acct_payments:delete", "acct_bank_transactions:update"]);
  });

  it("puts the invoice back and throws when the payment cannot be deleted", async () => {
    const { client, log } = fakeClient((c) => {
      if (c.table === "acct_payments" && c.op === "select") return { data: payment };
      if (c.table === "acct_invoices" && c.op === "select") return { data: invoice };
      if (c.table === "acct_invoices" && c.op === "update") return { data: invoice };
      if (c.table === "acct_payments" && c.op === "delete") return { error: { message: "connection reset" } };
      return {};
    });
    await expect(deletePayment("pay1", client)).rejects.toThrow(/Could not delete the payment/);
    const invoiceUpdates = log.filter((c) => c.table === "acct_invoices" && c.op === "update");
    expect(invoiceUpdates).toHaveLength(2);
    expect(invoiceUpdates[1].payload).toMatchObject({ amount_paid_cents: 10000, status: "paid" });
    expect(log.some((c) => c.table === "acct_bank_transactions")).toBe(false);
  });

  it("does not touch the payment when the invoice update fails", async () => {
    const { client, log } = fakeClient((c) => {
      if (c.table === "acct_payments" && c.op === "select") return { data: payment };
      if (c.table === "acct_invoices" && c.op === "select") return { data: invoice };
      if (c.table === "acct_invoices" && c.op === "update") return { error: { message: "timeout" } };
      return {};
    });
    await expect(deletePayment("pay1", client)).rejects.toThrow(/Could not update the invoice/);
    expect(log.some((c) => c.op === "delete")).toBe(false);
  });

  it("throws when the payment cannot be loaded, instead of saying it was not found", async () => {
    const { client } = fakeClient((c) => (c.table === "acct_payments" ? { error: { message: "timeout" } } : {}));
    await expect(deletePayment("pay1", client)).rejects.toThrow(/Could not load the payment/);
  });

  it("does not turn a void invoice back into a sent one", async () => {
    const voided = { ...invoice, status: "void" };
    const { client, log } = fakeClient((c) => {
      if (c.table === "acct_payments" && c.op === "select") return { data: { ...payment, bank_transaction_id: null } };
      if (c.table === "acct_invoices" && c.op === "select") return { data: voided };
      if (c.table === "acct_invoices" && c.op === "update") return { data: voided };
      return {};
    });
    await deletePayment("pay1", client);
    const first = log.find((c) => c.table === "acct_invoices" && c.op === "update");
    expect(first?.payload).toMatchObject({ status: "void" });
  });
});

describe("runAccountingDaily", () => {
  it("reports a failed read of the scheduled invoices instead of showing zero sent", async () => {
    const { client } = fakeClient((c) => (c.table === "acct_invoices" ? { error: { message: "timeout" } } : { data: [] }));
    const r = await runAccountingDaily(client);
    expect(r.sent).toBe(0);
    expect(r.sendErrors[0]).toMatch(/Could not load the scheduled invoices: timeout/);
  });

  it("reports nothing when no invoice is due", async () => {
    const { client } = fakeClient(() => ({ data: [] }));
    const r = await runAccountingDaily(client);
    expect(r.sendErrors).toEqual([]);
  });
});

describe("syncAllBanks", () => {
  it("reports a failed read of the bank connections instead of an empty sync", async () => {
    const { client } = fakeClient(() => ({ error: { message: "timeout" } }));
    const r = await syncAllBanks(client);
    expect(r.errors).toEqual(["Could not load the bank connections: timeout"]);
    expect(r.added).toBe(0);
  });
});
