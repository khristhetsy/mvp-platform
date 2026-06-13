"use client";

import { useEffect, useState, useMemo } from "react";
import type { AdminPortfolioRow } from "@/lib/portfolio/types";
import { STAGE_LABELS, STALE_VAL_DAYS } from "@/lib/portfolio/types";
import type { InvestmentStage } from "@/lib/portfolio/types";

const fmt = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : `$${n.toLocaleString()}`;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function isStale(row: AdminPortfolioRow): boolean {
  if (row.source !== "self_reported") return false;
  if (!row.val_updated_at) return true;
  return (daysSince(row.val_updated_at) ?? 0) > STALE_VAL_DAYS;
}

function moic(row: AdminPortfolioRow): number | null {
  if (!row.current_valuation || !row.entry_valuation || Number(row.entry_valuation) === 0)
    return null;
  return Number(row.current_valuation) / Number(row.entry_valuation);
}

function stageColor(stage: InvestmentStage | null) {
  switch (stage) {
    case "pre_seed":
    case "seed":       return { bg: "#EEEDFE", color: "#3C3489" };
    case "series_a":
    case "series_b":   return { bg: "#E6F1FB", color: "#0C447C" };
    case "growth":
    case "ipo":        return { bg: "#EAF3DE", color: "#27500A" };
    case "exited":     return { bg: "#E1F5EE", color: "#085041" };
    case "written_off":return { bg: "#FCEBEB", color: "#791F1F" };
    default:           return { bg: "#F1EFE8", color: "#444441" };
  }
}

interface Stats {
  total_invested: number;
  total_deals: number;
  investor_count: number;
  linked_count: number;
  stale_count: number;
  avg_multiple: number | null;
}

export function AdminPortfolioPageClient() {
  const [investments, setInvestments] = useState<AdminPortfolioRow[]>([]);
  const [stats, setStats]             = useState<Stats | null>(null);
  const [loading, setLoading]         = useState(true);
  const [notifySent, setNotifySent]   = useState(false);

  const [filterInvestor, setFilterInvestor] = useState("");
  const [filterStage, setFilterStage]       = useState("");
  const [filterSource, setFilterSource]     = useState<"" | "deal_room" | "self_reported" | "stale">("");
  const [search, setSearch]                 = useState("");

  useEffect(() => {
    fetch("/api/admin/portfolio")
      .then((r) => r.json())
      .then(({ investments: inv, stats: s }) => {
        setInvestments(Array.isArray(inv) ? inv : []);
        setStats(s ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  /* unique investors for dropdown */
  const investors = useMemo(() => {
    const seen = new Map<string, string>();
    investments.forEach((i) => {
      if (!seen.has(i.investor_user_id)) {
        seen.set(i.investor_user_id, i.investor_name ?? i.investor_email ?? i.investor_user_id.slice(0, 8));
      }
    });
    return [...seen.entries()];
  }, [investments]);

  const filtered = useMemo(() => {
    let list = investments;
    if (filterInvestor) list = list.filter((i) => i.investor_user_id === filterInvestor);
    if (filterStage)    list = list.filter((i) => i.stage === filterStage);
    if (filterSource === "deal_room")    list = list.filter((i) => i.source === "deal_room");
    if (filterSource === "self_reported")list = list.filter((i) => i.source === "self_reported");
    if (filterSource === "stale")        list = list.filter((i) => isStale(i));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.company_name.toLowerCase().includes(q) ||
          (i.investor_name ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [investments, filterInvestor, filterStage, filterSource, search]);

  const staleRows = investments.filter(isStale);

  return (
    <div style={{ fontFamily: "var(--font-sans)" }}>
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 18 }}>
        {[
          { label: "Platform AUM (tracked)", value: stats ? fmt(stats.total_invested) : "—", sub: `Across ${stats?.investor_count ?? 0} investors` },
          { label: "Total deals logged",     value: stats ? String(stats.total_deals) : "—",  sub: `${stats?.linked_count ?? 0} linked to deal room` },
          {
            label: "Stale valuations",
            value: stats ? String(stats.stale_count) : "—",
            sub: "Awaiting update",
            valueColor: (stats?.stale_count ?? 0) > 0 ? "#854F0B" : undefined,
          },
          {
            label: "Avg. return multiple",
            value: stats?.avg_multiple != null ? `${stats.avg_multiple.toFixed(2)}×` : "—",
            sub: "Across deals with valuation data",
          },
        ].map((c) => (
          <div key={c.label} style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "14px 16px" }}>
            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 4px" }}>{c.label}</p>
            <p style={{ fontSize: 20, fontWeight: 500, margin: 0, color: (c as { valueColor?: string }).valueColor ?? "var(--color-text-primary)" }}>{c.value}</p>
            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Stale banner */}
      {staleRows.length > 0 && (
        <div
          style={{
            background: "#FFFBEB",
            border: "0.5px solid #FAC775",
            borderRadius: "var(--border-radius-md)",
            padding: "10px 14px",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠</span>
          <p style={{ margin: 0, fontSize: 12.5, color: "#854F0B", flex: 1 }}>
            <strong style={{ fontWeight: 500 }}>{staleRows.length} investment{staleRows.length > 1 ? "s" : ""}</strong> have
            self-reported valuations older than {STALE_VAL_DAYS} days or no valuation on record.
          </p>
          <button
            onClick={() => setNotifySent(true)}
            disabled={notifySent}
            style={{
              flexShrink: 0,
              fontSize: 11.5,
              padding: "5px 12px",
              borderRadius: 6,
              background: notifySent ? "#E1F5EE" : "#FAEEDA",
              border: `0.5px solid ${notifySent ? "#5DCAA5" : "#EF9F27"}`,
              color: notifySent ? "#085041" : "#633806",
              cursor: notifySent ? "default" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {notifySent ? "✓ Notified" : "Notify investors"}
          </button>
        </div>
      )}

      {/* Table */}
      <div
        style={{
          background: "var(--color-background-primary)",
          border: "0.5px solid var(--color-border-tertiary)",
          borderRadius: "var(--border-radius-lg)",
          overflow: "hidden",
        }}
      >
        {/* Filters */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            borderBottom: "0.5px solid var(--color-border-tertiary)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 6, flex: 1, flexWrap: "wrap" }}>
            {(["", "deal_room", "self_reported", "stale"] as const).map((s) => {
              const label = s === "" ? "All deals" : s === "deal_room" ? "Deal room" : s === "self_reported" ? "Self-reported" : `Stale val. ⚠`;
              const active = filterSource === s;
              return (
                <button
                  key={s}
                  onClick={() => setFilterSource(s)}
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: active ? 500 : 400,
                    background: active ? (s === "stale" ? "#FFFBEB" : "#EEEDFE") : "var(--color-background-secondary)",
                    color: active ? (s === "stale" ? "#854F0B" : "#3C3489") : "var(--color-text-secondary)",
                    border: active ? "none" : "0.5px solid var(--color-border-tertiary)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company / investor…"
            style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", width: 180 }}
          />
          <select
            value={filterInvestor}
            onChange={(e) => setFilterInvestor(e.target.value)}
            style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)" }}
          >
            <option value="">All investors</option>
            {investors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)" }}
          >
            <option value="">All stages</option>
            {Object.entries(STAGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--color-text-secondary)", fontSize: 13 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--color-text-secondary)", fontSize: 13 }}>
            No investments match this filter.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--color-background-secondary)" }}>
                  {["Company", "Investor", "Amount", "Entry val.", "Current val.", "Source", "Stage", "Return"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === "Company" || h === "Investor" ? "left" : "center",
                        padding: h === "Company" ? "8px 16px" : h === "Investor" ? "8px 10px" : "8px 10px",
                        color: "var(--color-text-secondary)",
                        fontWeight: 500,
                        fontSize: 11,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const stale = isStale(inv);
                  const m = moic(inv);
                  const sc = stageColor(inv.stage);
                  const daysOld = daysSince(inv.val_updated_at);
                  return (
                    <tr
                      key={inv.id}
                      style={{
                        borderTop: "0.5px solid var(--color-border-tertiary)",
                        background: stale ? "#FFFBEB" : undefined,
                      }}
                    >
                      {/* Company */}
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              width: 26, height: 26, borderRadius: 5,
                              background: sc.bg, color: sc.color,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 10, fontWeight: 500, flexShrink: 0,
                            }}
                          >
                            {inv.company_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontWeight: 500, fontSize: 12, color: "var(--color-text-primary)" }}>{inv.company_name}</p>
                            {stale && (
                              <p style={{ margin: 0, fontSize: 10.5, color: "#854F0B" }}>
                                Val. {daysOld != null ? `${daysOld}d old` : "never updated"} ⚠
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Investor */}
                      <td style={{ padding: "10px 10px" }}>
                        <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-primary)" }}>
                          {inv.investor_name ?? inv.investor_email ?? "—"}
                        </p>
                        <p style={{ margin: 0, fontSize: 10.5, color: "var(--color-text-secondary)" }}>
                          {new Date(inv.invested_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                        </p>
                      </td>
                      {/* Amount */}
                      <td style={{ textAlign: "center", padding: "10px 10px", color: "var(--color-text-primary)" }}>{fmt(Number(inv.amount_invested))}</td>
                      {/* Entry val */}
                      <td style={{ textAlign: "center", padding: "10px 10px", color: "var(--color-text-secondary)" }}>
                        {inv.entry_valuation ? fmt(Number(inv.entry_valuation)) : "—"}
                      </td>
                      {/* Current val */}
                      <td style={{ textAlign: "center", padding: "10px 10px", fontWeight: 500, color: stale ? "#854F0B" : "var(--color-text-primary)" }}>
                        {inv.current_valuation ? fmt(Number(inv.current_valuation)) : <span style={{ color: "var(--color-text-secondary)" }}>No update</span>}
                        {stale && inv.current_valuation ? " ?" : ""}
                      </td>
                      {/* Source */}
                      <td style={{ textAlign: "center", padding: "10px 10px" }}>
                        <span
                          style={{
                            background: inv.source === "deal_room" ? "#E1F5EE" : "#FAEEDA",
                            color: inv.source === "deal_room" ? "#085041" : "#633806",
                            fontSize: 10,
                            padding: "2px 7px",
                            borderRadius: 999,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {inv.source === "deal_room" ? "Deal room" : "Self-reported"}
                        </span>
                      </td>
                      {/* Stage */}
                      <td style={{ textAlign: "center", padding: "10px 10px" }}>
                        {inv.stage ? (
                          <span style={{ background: sc.bg, color: sc.color, fontSize: 10, padding: "2px 7px", borderRadius: 999 }}>
                            {STAGE_LABELS[inv.stage]}
                          </span>
                        ) : <span style={{ color: "var(--color-text-secondary)" }}>—</span>}
                      </td>
                      {/* Return */}
                      <td style={{ textAlign: "center", padding: "10px 10px" }}>
                        {m !== null ? (
                          <span style={{ color: m >= 1 ? "#3B6D11" : "#A32D2D", fontWeight: 500 }}>
                            {m >= 1 ? "+" : ""}{m.toFixed(2)}×
                          </span>
                        ) : <span style={{ color: "var(--color-text-secondary)" }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: "10px 16px", borderTop: "0.5px solid var(--color-border-tertiary)", fontSize: 11.5, color: "var(--color-text-secondary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Showing {filtered.length} of {investments.length} deals across {stats?.investor_count ?? 0} investors</span>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "#E1F5EE", display: "inline-block" }} />Deal room
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "#FAEEDA", display: "inline-block" }} />Self-reported
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
