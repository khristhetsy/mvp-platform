"use client";

import { useCallback, useMemo, useState } from "react";

const navy = "#0A1A40", blue = "#1A6CE4";

interface Customer {
  profileId: string; name: string; email: string; planLabel: string; status: string;
  priceCents: number; currency: string; currentPeriodEnd: string | null; lsCustomerId: string | null; lsSubscriptionId: string | null;
}
interface Stats { mrrCents: number; activeCount: number; trialCount: number; pendingUpgrades: number }
interface Health { configured: boolean; lastSyncAt: string | null }
interface Invoice { id: string; total: number; totalFormatted: string; currency: string; status: string; refunded: boolean; createdAt: string; invoiceUrl: string | null }
interface Detail { customer: Customer | null; invoices: Invoice[]; statement: { invoicedCents: number; paidCents: number; dueCents: number; currency: string } }
export interface UpgradeRequest { id: string; name: string; email: string; type: string; plan: string; feature: string; status: string; createdAt: string }

function money(cents: number, currency = "USD"): string {
  try { return (cents / 100).toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 0 }); }
  catch { return `$${Math.round(cents / 100).toLocaleString()}`; }
}
function ago(iso: string | null): string {
  if (!iso) return "never";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${Math.max(m, 0)}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;
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

export function AdminBillingClient({ customers, stats, health, upgradeRequests }: { customers: Customer[]; stats: Stats; health: Health; upgradeRequests: UpgradeRequest[] }) {
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? customers.filter((c) => c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s) || c.planLabel.toLowerCase().includes(s)) : customers;
  }, [q, customers]);

  const openCustomer = useCallback(async (c: Customer) => {
    setOpenId(c.profileId); setDetail(null); setLoading(true);
    try { const r = await fetch(`/api/admin/billing/customers/${c.profileId}`); if (r.ok) setDetail(await r.json()); }
    catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  const card: React.CSSProperties = { background: "var(--surface-1, #F6F8FB)", borderRadius: 10, padding: "12px 14px" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {!health.configured && (
        <div style={{ fontSize: 12, color: "#A32D2D", background: "#FCEBEB", border: "0.5px solid #F09595", borderRadius: 10, padding: "8px 12px" }}>
          Lemon Squeezy webhook secret isn&apos;t set — recurring billing won&apos;t sync until <code>LEMONSQUEEZY_WEBHOOK_SECRET</code> is configured.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <div style={card}><div style={{ fontSize: 12, color: "#6B7690" }}>MRR</div><div style={{ fontSize: 22, fontWeight: 600, color: navy, marginTop: 2 }}>{money(stats.mrrCents)}</div></div>
        <div style={card}><div style={{ fontSize: 12, color: "#6B7690" }}>Active</div><div style={{ fontSize: 22, fontWeight: 600, color: navy, marginTop: 2 }}>{stats.activeCount}</div></div>
        <div style={card}><div style={{ fontSize: 12, color: "#6B7690" }}>Trials</div><div style={{ fontSize: 22, fontWeight: 600, color: navy, marginTop: 2 }}>{stats.trialCount}</div></div>
        <div style={card}><div style={{ fontSize: 12, color: "#6B7690" }}>Pending upgrades</div><div style={{ fontSize: 22, fontWeight: 600, color: navy, marginTop: 2 }}>{stats.pendingUpgrades}</div></div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: navy }}>Customers <span style={{ fontSize: 12.5, fontWeight: 400, color: "#6B7690" }}>· {customers.length}</span></div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#6B7690", background: "#F1EFE8", borderRadius: 99, padding: "3px 10px" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: health.configured ? "#0F6E56" : "#A32D2D" }} />
          Billing sync {health.configured ? `· last ${ago(health.lastSyncAt)}` : "not configured"}
        </span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers…" style={{ marginLeft: "auto", fontSize: 12.5, padding: "7px 11px", borderRadius: 8, border: "1px solid #E4E8F0", minWidth: 200 }} />
      </div>

      <div style={{ background: "#fff", border: "0.5px solid #E4E8F0", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 0.9fr 0.9fr 1fr", padding: "9px 14px", background: "#F6F8FB", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em", color: "#6B7690" }}>
          <div>Client</div><div>Plan</div><div>Status</div><div>MRR</div><div>Renews</div>
        </div>
        {filtered.length === 0 ? <div style={{ padding: 16, fontSize: 12.5, color: "#6B7690" }}>No customers.</div>
          : filtered.map((c) => (
            <button key={c.profileId} onClick={() => openCustomer(c)} style={{ width: "100%", textAlign: "left", display: "grid", gridTemplateColumns: "1.6fr 1fr 0.9fr 0.9fr 1fr", padding: "10px 14px", alignItems: "center", background: "none", borderTop: "0.5px solid #F1F4F9", borderLeft: "none", borderRight: "none", borderBottom: "none", cursor: "pointer" }}>
              <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.name}</div><div style={{ fontSize: 11, color: "#6B7690" }}>{c.email}</div></div>
              <div><span style={{ fontSize: 10.5, background: "#EEF3FC", color: "#185FA5", borderRadius: 6, padding: "2px 8px" }}>{c.planLabel}</span></div>
              <div>{statusPill(c.status)}</div>
              <div style={{ fontSize: 12.5, color: navy }}>{c.priceCents > 0 ? money(c.priceCents, c.currency) : <span style={{ color: "#98A2B3" }}>—</span>}</div>
              <div style={{ fontSize: 12, color: "#6B7690" }}>{date(c.currentPeriodEnd)}</div>
            </button>
          ))}
      </div>

      {openId && (
        <div onClick={() => setOpenId(null)} style={{ position: "fixed", inset: 0, background: "rgba(10,26,64,.4)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(480px, 94vw)", height: "100%", background: "#fff", overflowY: "auto", padding: 22 }}>
            {loading || !detail ? <div style={{ fontSize: 13, color: "#6B7690" }}>Loading…</div> : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: navy }}>{detail.customer?.name ?? "Customer"}</div>
                  {detail.customer && statusPill(detail.customer.status)}
                  <button onClick={() => setOpenId(null)} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 18, color: "#6B7690", cursor: "pointer" }}>✕</button>
                </div>

                <Section title="Profile">
                  <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.7 }}>
                    {detail.customer?.email}{detail.customer?.lsCustomerId ? ` · LS customer #${detail.customer.lsCustomerId}` : ""}
                  </div>
                </Section>

                <Section title="Plan">
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                    <span style={{ fontWeight: 600 }}>{detail.customer?.planLabel} · {detail.customer && detail.customer.priceCents > 0 ? `${money(detail.customer.priceCents, detail.customer.currency)}/mo` : "—"}</span>
                    <span style={{ color: "#6B7690" }}>renews {date(detail.customer?.currentPeriodEnd ?? null)}</span>
                  </div>
                </Section>

                <Section title="Invoices">
                  {detail.invoices.length === 0 ? <div style={{ fontSize: 12, color: "#6B7690" }}>No invoices found in Lemon Squeezy for this subscription.</div>
                    : detail.invoices.map((inv, i) => (
                      <div key={inv.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderTop: i ? "0.5px solid #F1F4F9" : "none" }}>
                        <span>{date(inv.createdAt)} · {inv.totalFormatted || money(inv.total, inv.currency)}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {invStatusPill(inv.status, inv.refunded)}
                          {inv.invoiceUrl && <a href={inv.invoiceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: blue, textDecoration: "none" }}>PDF ↗</a>}
                        </span>
                      </div>
                    ))}
                </Section>

                <Section title="Statement">
                  <div style={{ display: "flex", gap: 16, fontSize: 12.5 }}>
                    <span style={{ color: "#6B7690" }}>Invoiced <b style={{ color: navy }}>{money(detail.statement.invoicedCents, detail.statement.currency)}</b></span>
                    <span style={{ color: "#6B7690" }}>Paid <b style={{ color: "#0F6E56" }}>{money(detail.statement.paidCents, detail.statement.currency)}</b></span>
                    <span style={{ color: "#6B7690" }}>Due <b style={{ color: detail.statement.dueCents > 0 ? "#A32D2D" : navy }}>{money(detail.statement.dueCents, detail.statement.currency)}</b></span>
                  </div>
                </Section>
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: 6 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: navy, marginBottom: 10 }}>Upgrade requests <span style={{ fontSize: 12.5, fontWeight: 400, color: "#6B7690" }}>· {upgradeRequests.length}</span></div>
        <div style={{ background: "#fff", border: "0.5px solid #E4E8F0", borderRadius: 12, overflow: "hidden" }}>
          {upgradeRequests.length === 0 ? <div style={{ padding: 16, fontSize: 12.5, color: "#6B7690" }}>No upgrade requests.</div>
            : upgradeRequests.map((r, i) => (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 10, padding: "11px 14px", borderTop: i ? "0.5px solid #F1F4F9" : "none", fontSize: 12.5 }}>
                <div><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: 11, color: "#6B7690" }}>{r.email}</div></div>
                <div style={{ color: "#475569" }}>{r.type.replaceAll("_", " ")}{r.plan !== "—" ? ` · ${r.plan}` : ""}</div>
                <div style={{ color: "#475569" }}>{statusPill(r.status)} <span style={{ fontSize: 11, color: "#98A2B3", marginLeft: 6 }}>{date(r.createdAt)}</span></div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "0.5px solid #E4E8F0", borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".7px", textTransform: "uppercase", color: "#6B7690", marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}
