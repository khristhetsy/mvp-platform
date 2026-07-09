"use client";

import Link from "next/link";

const navy = "#0A1A40", blue = "#1A6CE4";

interface Invoice { id: string; total: number; totalFormatted: string; currency: string; status: string; refunded: boolean; createdAt: string; invoiceUrl: string | null }
interface Customer { name: string; email: string; planLabel: string; currency: string }
interface Payment { cardBrand: string | null; cardLastFour: string | null }

function money(cents: number, currency = "USD"): string {
  try { return (cents / 100).toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 2 }); }
  catch { return `$${(cents / 100).toFixed(2)}`; }
}
function fullDate(iso: string): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
}
function cardLabel(p: Payment | null): string {
  if (!p?.cardLastFour) return "—";
  const brand = p.cardBrand ? p.cardBrand.charAt(0).toUpperCase() + p.cardBrand.slice(1) : "Card";
  return `${brand} •••• ${p.cardLastFour}`;
}

export function BillingInvoiceDocument({ profileId, invoice, customer, payment }: { profileId: string; invoice: Invoice | null; customer: Customer | null; payment: Payment | null }) {
  if (!invoice || !customer) {
    return (
      <div>
        <Link href={`/admin/billing/${profileId}`} style={{ fontSize: 12, color: blue, textDecoration: "none" }}>← Back to customer</Link>
        <p style={{ fontSize: 13, color: "#6B7690", marginTop: 12 }}>Invoice not found.</p>
      </div>
    );
  }
  const label = invoice.refunded ? "refunded" : invoice.status;
  const tone = label === "paid" ? { bg: "#E1F5EE", c: "#0F6E56" } : label === "pending" ? { bg: "#FAEEDA", c: "#854F0B" } : { bg: "#F1EFE8", c: "#5F5E5A" };
  const amount = invoice.totalFormatted || money(invoice.total, invoice.currency);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Link href={`/admin/billing/${profileId}`} style={{ fontSize: 12, color: blue, textDecoration: "none" }}>← Back to customer</Link>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {invoice.invoiceUrl && <a href={invoice.invoiceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: navy, background: "#F1EFE8", borderRadius: 8, padding: "7px 13px", textDecoration: "none" }}>Lemon Squeezy PDF ↗</a>}
          <button onClick={() => window.print()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: navy, border: "none", borderRadius: 8, padding: "7px 13px", cursor: "pointer" }}>Print</button>
        </div>
      </div>

      <div style={{ background: "#fff", border: "0.5px solid #E4E8F0", borderRadius: 12, padding: 24, maxWidth: 720 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: navy }}>iCapOS</div>
            <div style={{ fontSize: 11.5, color: "#6B7690" }}>iCFO Capital Global, Inc.</div>
            <div style={{ fontSize: 11.5, color: "#6B7690" }}>billing@icapos.com</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: ".04em", color: navy }}>INVOICE</div>
            <div style={{ fontSize: 12, color: "#6B7690" }}>#{invoice.id}</div>
            <span style={{ display: "inline-block", marginTop: 4, fontSize: 10.5, fontWeight: 600, background: tone.bg, color: tone.c, borderRadius: 6, padding: "2px 8px" }}>{label}</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 30px", marginTop: 18, fontSize: 12 }}>
          <div><span style={{ color: "#98A2B3" }}>Bill to</span><div style={{ color: navy, marginTop: 2 }}>{customer.name}</div><div style={{ color: "#6B7690" }}>{customer.email}</div></div>
          <div style={{ textAlign: "right", color: "#6B7690" }}><div><span style={{ color: "#98A2B3" }}>Issued</span> {fullDate(invoice.createdAt)}</div></div>
        </div>

        <div style={{ marginTop: 18, border: "0.5px solid #E4E8F0", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2.6fr 0.8fr", background: "#F6F8FB", padding: "8px 12px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em", color: "#6B7690" }}><span>Description</span><span style={{ textAlign: "right" }}>Amount</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "2.6fr 0.8fr", padding: "10px 12px", fontSize: 12.5 }}><span>{customer.planLabel} — subscription</span><span style={{ textAlign: "right" }}>{amount}</span></div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <div style={{ width: 220, fontSize: 12.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span style={{ color: "#6B7690" }}>Subtotal</span><span>{amount}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span style={{ color: "#6B7690" }}>Tax</span><span>{money(0, invoice.currency)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "0.5px solid #E4E8F0", fontWeight: 600, fontSize: 13.5 }}><span>Total</span><span>{amount} {invoice.currency}</span></div>
          </div>
        </div>

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid #E4E8F0", fontSize: 12, color: "#6B7690" }}>
          {label === "paid" ? "Paid with" : "Payment method"} <span style={{ color: navy }}>{cardLabel(payment)}</span>
        </div>
      </div>
    </div>
  );
}
