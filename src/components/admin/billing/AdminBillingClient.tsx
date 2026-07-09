"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/ui/format-display";

const navy = "#0A1A40";

interface Customer {
  profileId: string; name: string; email: string; planLabel: string; status: string;
  priceCents: number; currency: string; currentPeriodEnd: string | null; lsCustomerId: string | null; lsSubscriptionId: string | null;
}
interface Stats { mrrCents: number; activeCount: number; trialCount: number; pendingUpgrades: number }
interface Health { configured: boolean; lastSyncAt: string | null }
export interface UpgradeRequest { id: string; name: string; email: string; type: string; plan: string; feature: string; status: string; createdAt: string }

function money(cents: number, currency = "USD"): string {
  return formatCurrency(cents, { cents: true, currency });
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

export function AdminBillingClient({ customers, stats, health, upgradeRequests }: { customers: Customer[]; stats: Stats; health: Health; upgradeRequests: UpgradeRequest[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? customers.filter((c) => c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s) || c.planLabel.toLowerCase().includes(s)) : customers;
  }, [q, customers]);

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
            <Link key={c.profileId} href={`/admin/billing/${c.profileId}`} style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 0.9fr 0.9fr 1fr", padding: "10px 14px", borderTop: "0.5px solid #F1F4F9", alignItems: "center", textDecoration: "none", color: "inherit" }}>
              <div><div style={{ fontSize: 12.5, fontWeight: 600, color: navy }}>{c.name}</div><div style={{ fontSize: 11, color: "#6B7690" }}>{c.email}</div></div>
              <div><span style={{ fontSize: 10.5, background: "#EEF3FC", color: "#185FA5", borderRadius: 6, padding: "2px 8px" }}>{c.planLabel}</span></div>
              <div>{statusPill(c.status)}</div>
              <div style={{ fontSize: 12.5, color: navy }}>{c.priceCents > 0 ? money(c.priceCents, c.currency) : <span style={{ color: "#98A2B3" }}>—</span>}</div>
              <div style={{ fontSize: 12, color: "#6B7690" }}>{date(c.currentPeriodEnd)}</div>
            </Link>
          ))}
      </div>

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
