"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContactListResult } from "@/lib/prospects/store";
import { LEAD_STATUSES, LEAD_STATUS_LABEL, type LeadStatus } from "@/lib/prospects/lead-status";

const SEG_COLOR: Record<string, string> = { hot: "#B91C1C", warm: "#92400E", cold: "#475569" };
const STATUS_COLOR: Record<string, string> = { valid: "#0F6E56", risky: "#92400E", invalid: "#B91C1C", unverified: "#475569" };
const LEAD_COLOR: Record<string, string> = {
  new: "#475569", contacted: "#1A6CE4", engaged: "#0369A1", qualified: "#0F6E56",
  nurturing: "#92400E", converted: "#047857", disqualified: "#B91C1C",
};

interface Filters { side: string; segment: string; status: string; leadStatus: string; search: string }

const GRID = "2fr 1.1fr 74px 70px 70px 118px 52px";

export function ContactListStep({ result, filters }: { result: ContactListResult; filters: Filters }) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search);
  const [busy, setBusy] = useState<string | null>(null);

  function nav(patch: Partial<Filters>) {
    const f = { ...filters, ...patch };
    const p = new URLSearchParams({ step: "list" });
    if (f.side) p.set("side", f.side);
    if (f.segment) p.set("segment", f.segment);
    if (f.status) p.set("status", f.status);
    if (f.leadStatus) p.set("leadStatus", f.leadStatus);
    if (f.search) p.set("search", f.search);
    router.push(`/admin/marketing/prospects?${p.toString()}`);
  }

  async function setLead(contactId: string, status: LeadStatus) {
    setBusy(contactId);
    try {
      const res = await fetch("/api/prospects/lead-status", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, status }),
      });
      if (res.ok) router.refresh();
    } finally { setBusy(null); }
  }

  const exportParams = new URLSearchParams();
  if (filters.side) exportParams.set("side", filters.side);
  if (filters.segment) exportParams.set("segment", filters.segment);
  if (filters.status) exportParams.set("status", filters.status);
  if (filters.leadStatus) exportParams.set("leadStatus", filters.leadStatus);
  if (filters.search) exportParams.set("search", filters.search);

  const sel: React.CSSProperties = { fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--muted-foreground)" };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 180, display: "flex", alignItems: "center", background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "7px 12px" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && nav({ search })} placeholder="Search name, email, company…" style={{ flex: 1, border: "none", outline: "none", fontSize: 13, background: "transparent", color: "var(--foreground)" }} />
        </div>
        <select value={filters.side} onChange={(e) => nav({ side: e.target.value })} style={sel}><option value="">All sides</option><option value="founder">Founders</option><option value="investor">Investors</option></select>
        <select value={filters.leadStatus} onChange={(e) => nav({ leadStatus: e.target.value })} style={{ ...sel, borderColor: filters.leadStatus ? "#2E78F5" : "var(--border)", color: filters.leadStatus ? "#1A6CE4" : "var(--muted-foreground)" }}><option value="">Any lead status</option>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}</select>
        <select value={filters.segment} onChange={(e) => nav({ segment: e.target.value })} style={sel}><option value="">All segments</option><option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option></select>
        <select value={filters.status} onChange={(e) => nav({ status: e.target.value })} style={sel}><option value="">Any email status</option><option value="valid">Valid</option><option value="risky">Risky</option><option value="invalid">Invalid</option><option value="unverified">Unverified</option></select>
        <a href={`/api/prospects/export?${exportParams.toString()}`} style={{ fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 8, background: "#2E78F5", color: "#fff", textDecoration: "none" }}>Export CSV ↓</a>
      </div>

      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)" }}>
        <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "8px 16px", background: "var(--muted)", borderBottom: "0.5px solid #e2e6ed", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)" }}>
          <div>Contact</div><div>Company</div><div>Side</div><div>Segment</div><div>Email</div><div>Lead status</div><div style={{ textAlign: "right" }}>Score</div>
        </div>
        {result.rows.length === 0 ? (
          <p style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--muted-foreground)" }}>No contacts match these filters.</p>
        ) : result.rows.map((r) => (
          <div key={r.id} style={{ display: "grid", gridTemplateColumns: GRID, padding: "10px 16px", borderBottom: "0.5px solid var(--border)", alignItems: "center", fontSize: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 500, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name || r.email}</div>
              {r.name ? <div style={{ fontSize: 11, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.email}</div> : null}
            </div>
            <div style={{ color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.company ?? "—"}</div>
            <div style={{ color: "var(--muted-foreground)" }}>{r.side ?? "—"}</div>
            <div><span style={{ fontSize: 11, fontWeight: 600, color: r.segment ? SEG_COLOR[r.segment] : "var(--muted-foreground)" }}>{r.segment ?? "—"}</span></div>
            <div><span style={{ fontSize: 11, color: r.email_status ? STATUS_COLOR[r.email_status] : "var(--muted-foreground)" }}>{r.email_status ?? "—"}</span></div>
            <div>
              <select
                value={(r.lead_status ?? "new") as string}
                disabled={busy === r.id}
                onChange={(e) => setLead(r.id, e.target.value as LeadStatus)}
                style={{ fontSize: 11, fontWeight: 600, padding: "3px 6px", borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--background)", color: LEAD_COLOR[r.lead_status ?? "new"] ?? "var(--foreground)", maxWidth: 112, opacity: busy === r.id ? 0.5 : 1 }}
              >
                {LEAD_STATUSES.map((s) => <option key={s} value={s} style={{ color: "var(--foreground)" }}>{LEAD_STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <div style={{ textAlign: "right", fontWeight: 600 }}>{typeof r.lead_prescore === "number" ? r.lead_prescore : "—"}</div>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 10, fontSize: 12, color: "var(--muted-foreground)" }}>{result.total.toLocaleString()} contacts match · showing first {result.rows.length}. Set a contact&rsquo;s lead status inline — it auto-advances from activity, and you can override any time.</p>
    </div>
  );
}
