"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

const navy = "#0A1A40", blue = "#1A6CE4";

interface Customer {
  profileId: string; name: string; email: string; planLabel: string; status: string;
  priceCents: number; currency: string; currentPeriodEnd: string | null; lsCustomerId: string | null; lsSubscriptionId: string | null;
}
interface Invoice { id: string; total: number; totalFormatted: string; currency: string; status: string; refunded: boolean; createdAt: string; invoiceUrl: string | null }
export interface Detail { customer: Customer | null; invoices: Invoice[]; statement: { invoicedCents: number; paidCents: number; dueCents: number; currency: string } }

function money(cents: number, currency = "USD"): string {
  try { return (cents / 100).toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 0 }); }
  catch { return `$${Math.round(cents / 100).toLocaleString()}`; }
}
function date(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
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

  if (!c) {
    return (
      <div>
        <Link href="/admin/billing" style={{ fontSize: 12, color: blue, textDecoration: "none" }}>← Billing</Link>
        <p style={{ fontSize: 13, color: "#6B7690", marginTop: 12 }}>Customer not found.</p>
      </div>
    );
  }

  const btn = (bg: string, color: string, extra?: React.CSSProperties): React.CSSProperties => ({ fontSize: 12, fontWeight: 600, color, background: bg, border: "none", borderRadius: 8, padding: "8px 13px", cursor: "pointer", ...extra });

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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0 40px", marginTop: 16 }}>
          <div>
            <Field label="Plan">{c.planLabel}</Field>
            <Field label="Price">{c.priceCents > 0 ? `${money(c.priceCents, c.currency)}/mo` : "—"}</Field>
            <Field label="Status">{c.status}</Field>
            <Field label="Renews">{date(c.currentPeriodEnd)}</Field>
          </div>
          <div>
            <Field label="Email"><span style={{ color: "#185FA5" }}>{c.email}</span></Field>
            <Field label="Currency">{c.currency}</Field>
            <Field label="LS customer">{c.lsCustomerId ? `#${c.lsCustomerId}` : "—"}</Field>
            <Field label="Subscription">{c.lsSubscriptionId ?? "—"}</Field>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)", gap: 14, marginTop: 14, alignItems: "start" }}>
        <div style={{ background: "#fff", border: "0.5px solid #E4E8F0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "11px 14px", borderBottom: "0.5px solid #F1F4F9", fontSize: 13, fontWeight: 600 }}>Invoices</div>
          {detail.invoices.length === 0 ? <div style={{ padding: 16, fontSize: 12, color: "#6B7690" }}>No invoices found in Lemon Squeezy for this subscription.</div>
            : detail.invoices.map((inv, i) => (
              <div key={inv.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, padding: "8px 14px", borderTop: i ? "0.5px solid #F1F4F9" : "none" }}>
                <span>{date(inv.createdAt)} · {inv.totalFormatted || money(inv.total, inv.currency)}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {invStatusPill(inv.status, inv.refunded)}
                  {inv.invoiceUrl && <a href={inv.invoiceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: blue, textDecoration: "none" }}>PDF ↗</a>}
                </span>
              </div>
            ))}
        </div>

        <div style={{ background: "#F6F8FB", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", color: "#6B7690", marginBottom: 8 }}>Statement</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6B7690" }}>Invoiced</span><b style={{ color: navy }}>{money(detail.statement.invoicedCents, detail.statement.currency)}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6B7690" }}>Paid</span><b style={{ color: "#0F6E56" }}>{money(detail.statement.paidCents, detail.statement.currency)}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6B7690" }}>Due</span><b style={{ color: detail.statement.dueCents > 0 ? "#A32D2D" : navy }}>{money(detail.statement.dueCents, detail.statement.currency)}</b></div>
          </div>
        </div>
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
