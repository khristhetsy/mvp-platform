"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

const navy = "#0A1A40", blue = "#1A6CE4";

interface Customer {
  profileId: string; name: string; email: string; planLabel: string; status: string;
  priceCents: number; currency: string; currentPeriodEnd: string | null; lsCustomerId: string | null; lsSubscriptionId: string | null;
}
interface Invoice { id: string; total: number; totalFormatted: string; currency: string; status: string; refunded: boolean; createdAt: string; invoiceUrl: string | null }
interface Payment { cardBrand: string | null; cardLastFour: string | null; updatePaymentUrl: string | null }
export interface Detail { customer: Customer | null; invoices: Invoice[]; payment: Payment | null; statement: { invoicedCents: number; paidCents: number; dueCents: number; currency: string } }

function money(cents: number, currency = "USD"): string {
  try { return (cents / 100).toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 0 }); }
  catch { return `$${Math.round(cents / 100).toLocaleString()}`; }
}
function date(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
}
function cardLabel(p: Payment | null): string {
  if (!p?.cardLastFour) return "—";
  const brand = p.cardBrand ? p.cardBrand.charAt(0).toUpperCase() + p.cardBrand.slice(1) : "Card";
  return `${brand} •••• ${p.cardLastFour}`;
}
const STATUS_TONE: Record<string, { bg: string; c: string }> = {
  active: { bg: "#E1F5EE", c: "#0F6E56" }, trialing: { bg: "#FAEEDA", c: "#854F0B" },
  canceled: { bg: "#FCEBEB", c: "#A32D2D" }, expired: { bg: "#FCEBEB", c: "#A32D2D" },
  free: { bg: "#F1EFE8", c: "#5F5E5A" }, internal: { bg: "#EEF3FC", c: "#185FA5" },
};
function statusPill(s: string) {
  const t = STATUS_TONE[s] ?? { bg: "#F1EFE8", c: "#5F5E5A" };
  return <span style={{ fontSize: 10.5, fontWeight: 600, background: t.bg, color: t.c, borderRadius: 6, padding: "2px 8px" }}>{s}</span>;
}
function invStatusPill(s: string, refunded: boolean) {
  const label = refunded ? "refunded" : s;
  const t = label === "paid" ? { bg: "#E1F5EE", c: "#0F6E56" } : label === "pending" ? { bg: "#FAEEDA", c: "#854F0B" } : { bg: "#F1EFE8", c: "#5F5E5A" };
  return <span style={{ fontSize: 10, fontWeight: 600, background: t.bg, color: t.c, borderRadius: 6, padding: "1px 7px" }}>{label}</span>;
}
function initials(name: string): string {
  const p = name.trim().split(/\s+/); return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "—";
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "0.5px solid #F1F4F9", fontSize: 12.5 }}>
      <span style={{ color: "#6B7690" }}>{label}</span><span style={{ color: navy, textAlign: "right" }}>{children}</span>
    </div>
  );
}

export function BillingCustomerProfile({ detail }: { detail: Detail }) {
  const c = detail.customer;
  const [tab, setTab] = useState<"details" | "invoices" | "statement">("details");
  const [coPlan, setCoPlan] = useState<"founder_basic" | "founder_professional">("founder_basic");
  const [coBusy, setCoBusy] = useState<null | "link" | "email">(null);
  const [coUrl, setCoUrl] = useState<string | null>(null);
  const [coMsg, setCoMsg] = useState<string | null>(null);

  const createCheckout = useCallback(async (send: boolean) => {
    if (!c) return;
    setCoBusy(send ? "email" : "link"); setCoMsg(null);
    try {
      const r = await fetch(`/api/admin/billing/customers/${c.profileId}/checkout`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: coPlan, send }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setCoMsg(typeof d.error === "string" ? d.error : "Failed to create link."); return; }
      if (d.url) setCoUrl(d.url);
      if (send) setCoMsg(d.emailed ? "Checkout link emailed to the customer." : "Link created, but the email didn't send.");
    } catch { setCoMsg("Failed to create link."); }
    finally { setCoBusy(null); }
  }, [c, coPlan]);

  // Statement rows: oldest → newest with a running balance (pending charges accrue).
  const stmt = useMemo(() => {
    const chrono = [...detail.invoices].reverse();
    const balances = chrono.reduce<number[]>((acc, inv) => {
      const prev = acc.length ? acc[acc.length - 1] : 0;
      const paid = inv.status === "paid" && !inv.refunded;
      return [...acc, prev + (paid ? 0 : inv.total)];
    }, []);
    return chrono.map((inv, i) => ({ inv, balCents: balances[i] }));
  }, [detail.invoices]);

  const exportCsv = useCallback(() => {
    const header = "date,invoice,amount,status,currency";
    const lines = detail.invoices.map((i) => `${i.createdAt},${i.id},${(i.total / 100).toFixed(2)},${i.refunded ? "refunded" : i.status},${i.currency}`);
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `statement-${c?.name ?? "customer"}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [detail.invoices, c]);

  if (!c) {
    return (
      <div>
        <Link href="/admin/billing" style={{ fontSize: 12, color: blue, textDecoration: "none" }}>← Billing</Link>
        <p style={{ fontSize: 13, color: "#6B7690", marginTop: 12 }}>Customer not found.</p>
      </div>
    );
  }

  const btn = (bg: string, color: string): React.CSSProperties => ({ fontSize: 12, fontWeight: 600, color, background: bg, border: "none", borderRadius: 8, padding: "8px 13px", cursor: "pointer" });
  const tabBtn = (k: typeof tab, label: string) => (
    <button onClick={() => setTab(k)} style={{ fontSize: 13, fontWeight: tab === k ? 600 : 500, color: tab === k ? blue : "#6B7690", background: "none", border: "none", cursor: "pointer", padding: "9px 14px", borderBottom: tab === k ? `2px solid ${blue}` : "2px solid transparent" }}>{label}</button>
  );

  return (
    <div>
      <div style={{ fontSize: 12, color: "#6B7690", marginBottom: 12 }}>
        <Link href="/admin/billing" style={{ color: blue, textDecoration: "none" }}>← Billing</Link> / Customers / <span style={{ color: navy }}>{c.name}</span>
      </div>

      <div style={{ background: "#fff", border: "0.5px solid #E4E8F0", borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#E6F1FB", color: "#185FA5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600 }}>{initials(c.name)}</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 17, fontWeight: 600, color: navy }}>{c.name}</span>{statusPill(c.status)}</div>
            <div style={{ fontSize: 12.5, color: "#6B7690" }}>{c.planLabel} · {c.email}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 2, marginTop: 14, borderBottom: "0.5px solid #F1F4F9" }}>
          {tabBtn("details", "Details")}{tabBtn("invoices", `Invoices${detail.invoices.length ? ` (${detail.invoices.length})` : ""}`)}{tabBtn("statement", "Statement")}
        </div>

        {tab === "details" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0 40px", marginTop: 16 }}>
            <div>
              <Field label="Plan">{c.planLabel}</Field>
              <Field label="Price">{c.priceCents > 0 ? `${money(c.priceCents, c.currency)}/mo` : "—"}</Field>
              <Field label="Status">{c.status}</Field>
              <Field label="Renews">{date(c.currentPeriodEnd)}</Field>
              <Field label="Payment method">{cardLabel(detail.payment)}</Field>
            </div>
            <div>
              <Field label="Email"><span style={{ color: "#185FA5" }}>{c.email}</span></Field>
              <Field label="Currency">{c.currency}</Field>
              <Field label="LS customer">{c.lsCustomerId ? `#${c.lsCustomerId}` : "—"}</Field>
              <Field label="Subscription">{c.lsSubscriptionId ?? "—"}</Field>
              {detail.payment?.updatePaymentUrl && <Field label="Update card"><a href={detail.payment.updatePaymentUrl} target="_blank" rel="noopener noreferrer" style={{ color: blue, textDecoration: "none" }}>Lemon Squeezy ↗</a></Field>}
            </div>
          </div>
        )}

        {tab === "invoices" && (
          <div style={{ marginTop: 14 }}>
            {detail.invoices.length === 0 ? <div style={{ fontSize: 12.5, color: "#6B7690" }}>No invoices found in Lemon Squeezy for this subscription.</div>
              : detail.invoices.map((inv, i) => (
                <div key={inv.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, padding: "10px 0", borderTop: i ? "0.5px solid #F1F4F9" : "none" }}>
                  <Link href={`/admin/billing/${c.profileId}/invoice/${inv.id}`} style={{ color: navy, textDecoration: "none", fontWeight: 500 }}>{date(inv.createdAt)} · {inv.totalFormatted || money(inv.total, inv.currency)}</Link>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {invStatusPill(inv.status, inv.refunded)}
                    <Link href={`/admin/billing/${c.profileId}/invoice/${inv.id}`} style={{ fontSize: 11.5, color: blue, textDecoration: "none" }}>View →</Link>
                  </span>
                </div>
              ))}
          </div>
        )}

        {tab === "statement" && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 12.5, color: "#6B7690" }}>{detail.invoices.length} transaction{detail.invoices.length === 1 ? "" : "s"}</div>
              {detail.invoices.length > 0 && <button onClick={exportCsv} style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: blue, background: "#EEF3FC", border: "none", borderRadius: 7, padding: "5px 11px", cursor: "pointer" }}>Export CSV</button>}
            </div>
            {stmt.length === 0 ? <div style={{ fontSize: 12.5, color: "#6B7690" }}>No transactions yet.</div> : (
              <div style={{ border: "0.5px solid #E4E8F0", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.6fr 0.8fr 0.8fr 0.9fr", background: "#F6F8FB", padding: "8px 12px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em", color: "#6B7690" }}>
                  <span>Date</span><span>Description</span><span style={{ textAlign: "right" }}>Charge</span><span style={{ textAlign: "center" }}>Status</span><span style={{ textAlign: "right" }}>Balance</span>
                </div>
                {stmt.map(({ inv, balCents }, i) => (
                  <div key={inv.id} style={{ display: "grid", gridTemplateColumns: "0.9fr 1.6fr 0.8fr 0.8fr 0.9fr", padding: "9px 12px", fontSize: 12, alignItems: "center", borderTop: i ? "0.5px solid #F1F4F9" : "none" }}>
                    <span style={{ color: "#6B7690" }}>{date(inv.createdAt)}</span>
                    <span>{c.planLabel}</span>
                    <span style={{ textAlign: "right" }}>{inv.totalFormatted || money(inv.total, inv.currency)}</span>
                    <span style={{ textAlign: "center" }}>{invStatusPill(inv.status, inv.refunded)}</span>
                    <span style={{ textAlign: "right" }}>{money(balCents, detail.statement.currency)}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 18, justifyContent: "flex-end", marginTop: 12, fontSize: 12.5 }}>
              <span style={{ color: "#6B7690" }}>Invoiced <b style={{ color: navy }}>{money(detail.statement.invoicedCents, detail.statement.currency)}</b></span>
              <span style={{ color: "#6B7690" }}>Paid <b style={{ color: "#0F6E56" }}>{money(detail.statement.paidCents, detail.statement.currency)}</b></span>
              <span style={{ color: "#6B7690" }}>Balance due <b style={{ color: detail.statement.dueCents > 0 ? "#A32D2D" : navy }}>{money(detail.statement.dueCents, detail.statement.currency)}</b></span>
            </div>
          </div>
        )}
      </div>

      <div style={{ background: "#fff", border: "0.5px solid #E4E8F0", borderRadius: 12, padding: 14, marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: navy, marginBottom: 10 }}>Create checkout link</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={coPlan} onChange={(e) => setCoPlan(e.target.value as "founder_basic" | "founder_professional")} style={{ fontSize: 12.5, padding: "7px 10px", borderRadius: 8, border: "1px solid #E4E8F0" }}>
            <option value="founder_basic">Founder Pro — $499/mo</option>
            <option value="founder_professional">Founder Premium — $1,000/mo</option>
          </select>
          <button onClick={() => void createCheckout(false)} disabled={coBusy !== null} style={btn(navy, "#fff")}>{coBusy === "link" ? "Creating…" : "Create link"}</button>
          <button onClick={() => void createCheckout(true)} disabled={coBusy !== null} style={btn("#EEF3FC", blue)}>{coBusy === "email" ? "Sending…" : "Email to customer"}</button>
        </div>
        {coUrl && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <input readOnly value={coUrl} style={{ flex: 1, fontSize: 11.5, padding: "6px 9px", borderRadius: 7, border: "1px solid #E4E8F0", color: "#475569" }} />
            <button onClick={() => { void navigator.clipboard?.writeText(coUrl); setCoMsg("Link copied."); }} style={btn("#F1EFE8", navy)}>Copy</button>
          </div>
        )}
        {coMsg && <div style={{ fontSize: 11.5, color: /Failed|didn't/.test(coMsg) ? "#A32D2D" : "#0F6E56", marginTop: 6 }}>{coMsg}</div>}
        <div style={{ fontSize: 10.5, color: "#98A2B3", marginTop: 6, lineHeight: 1.5 }}>The customer enters their own card at Lemon Squeezy — this never charges a card from here.</div>
      </div>
    </div>
  );
}
