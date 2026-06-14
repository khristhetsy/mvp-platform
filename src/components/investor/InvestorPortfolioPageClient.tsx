"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import type {
  PortfolioInvestment,
  CreateInvestmentInput,
  UpdateInvestmentInput,
  InvestmentStage,
} from "@/lib/portfolio/types";
import { STAGE_LABELS } from "@/lib/portfolio/types";

/* ── format helpers ── */
const fmt = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `$${(n / 1_000).toFixed(1)}k`
    : `$${n.toLocaleString()}`;

function moic(inv: PortfolioInvestment): number | null {
  if (!inv.current_valuation || !inv.entry_valuation || Number(inv.entry_valuation) === 0)
    return null;
  return Number(inv.current_valuation) / Number(inv.entry_valuation);
}

function impliedValue(inv: PortfolioInvestment): number {
  const m = moic(inv);
  return m === null ? Number(inv.amount_invested) : Number(inv.amount_invested) * m;
}

function roiPct(inv: PortfolioInvestment): number | null {
  const m = moic(inv);
  return m === null ? null : (m - 1) * 100;
}

/* ── stage colours ── */
const STAGE_COLORS: Record<string, { bg: string; text: string; chart: string }> = {
  pre_seed:    { bg: "#EEEDFE", text: "#3C3489", chart: "#AFA9EC" },
  seed:        { bg: "#EEEDFE", text: "#3C3489", chart: "#534AB7" },
  series_a:    { bg: "#E6F1FB", text: "#0C447C", chart: "#3D8BD4" },
  series_b:    { bg: "#E6F1FB", text: "#0C447C", chart: "#0C447C" },
  growth:      { bg: "#EAF3DE", text: "#27500A", chart: "#5A9E2A" },
  ipo:         { bg: "#EAF3DE", text: "#27500A", chart: "#3B6D11" },
  exited:      { bg: "#E1F5EE", text: "#085041", chart: "#0C8E6E" },
  written_off: { bg: "#FCEBEB", text: "#791F1F", chart: "#D44040" },
};
function sc(stage: string | null) {
  return STAGE_COLORS[stage ?? ""] ?? { bg: "#F1EFE8", text: "#444441", chart: "#888780" };
}

const STAGES = Object.entries(STAGE_LABELS) as [InvestmentStage, string][];

/* ── donut chart ── */
function StageDonut({ investments }: { investments: PortfolioInvestment[] }) {
  const counts: Record<string, number> = {};
  for (const inv of investments) {
    const s = inv.stage ?? "unknown";
    counts[s] = (counts[s] ?? 0) + 1;
  }
  const entries = Object.entries(counts).filter(([, c]) => c > 0);
  const total = entries.reduce((s, [, c]) => s + c, 0);

  if (entries.length === 0) {
    return (
      <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: 0 }}>No deals yet</p>
    );
  }

  const R = 24, CX = 32, CY = 32, circ = 2 * Math.PI * R;
  let offset = 0;
  const slices = entries.map(([stage, count]) => {
    const dash = (count / total) * circ;
    const s = { stage, count, dash, gap: circ - dash, offset };
    offset += dash;
    return s;
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width={64} height={64} viewBox="0 0 64 64" style={{ flexShrink: 0 }} aria-hidden="true">
        {slices.map((sl) => (
          <circle
            key={sl.stage}
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={sc(sl.stage).chart}
            strokeWidth={10}
            strokeDasharray={`${sl.dash} ${sl.gap}`}
            strokeDashoffset={-sl.offset}
            transform={`rotate(-90 ${CX} ${CY})`}
          />
        ))}
        <text x={CX} y={CY + 1} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={600} fill="var(--color-text-primary)">{total}</text>
        <text x={CX} y={CY + 12} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="var(--color-text-secondary)">deals</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {slices.slice(0, 4).map((sl) => (
          <div key={sl.stage} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: sc(sl.stage).chart, flexShrink: 0 }} />
            <span style={{ color: "var(--color-text-secondary)" }}>
              {STAGE_LABELS[sl.stage as InvestmentStage] ?? sl.stage}
            </span>
            <span style={{ color: "var(--color-text-primary)", fontWeight: 500, marginLeft: 4 }}>{sl.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── CSV export ── */
function exportCSV(investments: PortfolioInvestment[]) {
  const headers = ["Company", "Sector", "Pledged", "Entry Val.", "Current Val.", "ROI %", "MOIC", "Stage", "Date", "Source", "Notes"];
  const rows = investments.map((inv) => {
    const r = roiPct(inv);
    const m = moic(inv);
    return [
      `"${inv.company_name}"`,
      `"${inv.sector ?? ""}"`,
      inv.amount_invested,
      inv.entry_valuation ?? "",
      inv.current_valuation ?? "",
      r !== null ? `${r.toFixed(1)}%` : "",
      m !== null ? `${m.toFixed(2)}x` : "",
      inv.stage ? STAGE_LABELS[inv.stage] : "",
      inv.invested_at,
      inv.source,
      `"${(inv.notes ?? "").replace(/"/g, "'")}"`,
    ].join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "portfolio.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ── form state ── */
interface FormState {
  company_name: string;
  sector: string;
  amount_invested: string;
  entry_valuation: string;
  current_valuation: string;
  stage: InvestmentStage | "";
  invested_at: string;
  notes: string;
  deal_room_id: string;
}

const EMPTY_FORM: FormState = {
  company_name: "", sector: "", amount_invested: "", entry_valuation: "",
  current_valuation: "", stage: "", invested_at: "", notes: "", deal_room_id: "",
};

type DealRoomOption = { id: string; title: string };

/* ════════════════════════════════════════════════════════ */
export function InvestorPortfolioPageClient() {
  const [investments, setInvestments] = useState<PortfolioInvestment[]>([]);
  const [dealRooms, setDealRooms]     = useState<DealRoomOption[]>([]);
  const [loading, setLoading]         = useState(true);

  const [tab, setTab]       = useState<"all" | "active" | "exited" | "written_off">("all");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [form, setForm]           = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");

  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  /* fetch on mount */
  useEffect(() => {
    Promise.all([
      fetch("/api/investor/portfolio-investments").then((r) => r.json()),
      fetch("/api/investor/deal-room").then((r) => r.json()),
    ])
      .then(([inv, dr]) => {
        setInvestments(Array.isArray(inv) ? inv : []);
        setDealRooms(Array.isArray(dr?.rooms) ? dr.rooms : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  /* close context menu on outside click */
  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(null);
    const timer = setTimeout(() => document.addEventListener("click", handler), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handler);
    };
  }, [menuOpen]);

  /* filtered list */
  const filtered = useMemo(() => {
    let list = investments;
    if (tab === "active")      list = list.filter((i) => i.stage !== "exited" && i.stage !== "written_off");
    if (tab === "exited")      list = list.filter((i) => i.stage === "exited");
    if (tab === "written_off") list = list.filter((i) => i.stage === "written_off");
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) =>
        i.company_name.toLowerCase().includes(q) || (i.sector ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [investments, tab, search]);

  /* stat aggregates */
  const totalPledge  = investments.reduce((s, i) => s + Number(i.amount_invested), 0);
  const totalValue   = investments.reduce((s, i) => s + impliedValue(i), 0);
  const totalRoi     = totalValue - totalPledge;
  const totalRoiPct  = totalPledge > 0 ? (totalRoi / totalPledge) * 100 : 0;

  /* form helpers */
  const openAdd = useCallback(() => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  }, []);

  const openEdit = useCallback((inv: PortfolioInvestment) => {
    setEditId(inv.id);
    setForm({
      company_name:      inv.company_name,
      sector:            inv.sector ?? "",
      amount_invested:   String(inv.amount_invested),
      entry_valuation:   inv.entry_valuation != null ? String(inv.entry_valuation) : "",
      current_valuation: inv.current_valuation != null ? String(inv.current_valuation) : "",
      stage:             inv.stage ?? "",
      invested_at:       inv.invested_at.slice(0, 10),
      notes:             inv.notes ?? "",
      deal_room_id:      inv.deal_room_id ?? "",
    });
    setFormError("");
    setShowForm(true);
  }, []);

  async function handleSave() {
    setFormError("");
    if (!form.company_name.trim())                        { setFormError("Company name is required."); return; }
    if (!form.amount_invested || Number(form.amount_invested) <= 0) { setFormError("Amount must be positive."); return; }
    if (!form.invested_at)                                { setFormError("Investment date is required."); return; }

    setSaving(true);
    try {
      if (editId) {
        const body: UpdateInvestmentInput = {
          company_name:      form.company_name,
          sector:            form.sector || null,
          amount_invested:   Number(form.amount_invested),
          entry_valuation:   form.entry_valuation ? Number(form.entry_valuation) : null,
          current_valuation: form.current_valuation ? Number(form.current_valuation) : null,
          stage:             (form.stage as InvestmentStage) || null,
          invested_at:       form.invested_at,
          notes:             form.notes || null,
        };
        const res = await fetch(`/api/investor/portfolio-investments/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Update failed");
        const updated: PortfolioInvestment = await res.json();
        setInvestments((prev) => prev.map((i) => (i.id === editId ? updated : i)));
      } else {
        const body: CreateInvestmentInput = {
          company_name:      form.company_name,
          sector:            form.sector || null,
          amount_invested:   Number(form.amount_invested),
          entry_valuation:   form.entry_valuation ? Number(form.entry_valuation) : null,
          current_valuation: form.current_valuation ? Number(form.current_valuation) : null,
          stage:             (form.stage as InvestmentStage) || null,
          invested_at:       form.invested_at,
          notes:             form.notes || null,
          deal_room_id:      form.deal_room_id || null,
        };
        const res = await fetch("/api/investor/portfolio-investments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Create failed");
        const created: PortfolioInvestment = await res.json();
        setInvestments((prev) => [created, ...prev]);
      }
      setShowForm(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    setMenuOpen(null);
    try {
      await fetch(`/api/investor/portfolio-investments/${id}`, { method: "DELETE" });
      setInvestments((prev) => prev.filter((i) => i.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  const field = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  /* ── render ── */
  return (
    <div style={{ fontFamily: "var(--font-sans)" }}>

      {/* ── Stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>

        {/* Total Pledge */}
        <div style={cardSt}>
          <p style={cardLabel}>Total Pledge</p>
          <p style={cardValue}>{fmt(totalPledge)}</p>
          <p style={cardSub}>{investments.length} deal{investments.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Portfolio value */}
        <div style={cardSt}>
          <p style={cardLabel}>Portfolio value</p>
          <p style={cardValue}>{fmt(totalValue)}</p>
          <p style={{ ...cardSub, color: totalRoi >= 0 ? "#3B6D11" : "#A32D2D" }}>
            {totalPledge > 0 ? `${totalRoiPct >= 0 ? "+" : ""}${totalRoiPct.toFixed(1)}% unrealized` : "—"}
          </p>
        </div>

        {/* Total potential ROI */}
        <div style={cardSt}>
          <p style={cardLabel}>Total potential ROI</p>
          <p style={{ ...cardValue, color: totalRoi >= 0 ? "#3B6D11" : "#A32D2D" }}>
            {totalRoi >= 0 ? "+" : ""}{fmt(Math.abs(totalRoi))}
          </p>
          <p style={cardSub}>vs. cost basis</p>
        </div>

        {/* Deal stage mix — donut */}
        <div style={cardSt}>
          <p style={{ ...cardLabel, marginBottom: 10 }}>Deal stage mix</p>
          <StageDonut investments={investments} />
        </div>
      </div>

      {/* ── Table card ── */}
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "0.5px solid var(--color-border-tertiary)", flexWrap: "wrap" }}>
          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 5, flex: 1, flexWrap: "wrap" }}>
            {(["all", "active", "exited", "written_off"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                  fontWeight: tab === t ? 500 : 400,
                  background: tab === t ? "#EEEDFE" : "var(--color-background-secondary)",
                  color: tab === t ? "#3C3489" : "var(--color-text-secondary)",
                  border: tab === t ? "none" : "0.5px solid var(--color-border-tertiary)",
                }}
              >
                {t === "all" ? "All" : t === "written_off" ? "Written off" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals…"
            style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", width: 148 }}
          />

          {/* Export */}
          <button
            onClick={() => exportCSV(investments)}
            title="Export to CSV"
            style={{ fontSize: 12, padding: "5px 11px", borderRadius: 6, background: "none", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)", cursor: "pointer" }}
          >
            Export CSV
          </button>

          {/* Add investment */}
          <button
            onClick={openAdd}
            style={{ fontSize: 12, padding: "5px 13px", borderRadius: 6, background: "#534AB7", color: "#fff", border: "none", cursor: "pointer", fontWeight: 500 }}
          >
            + Add investment
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--color-text-secondary)", fontSize: 13 }}>
            Loading investments…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px 16px", textAlign: "center" }}>
            <p style={{ color: "var(--color-text-secondary)", fontSize: 13, margin: 0 }}>
              {investments.length === 0
                ? "No investments logged yet. Add your first deal to start tracking."
                : "No deals match the current filter."}
            </p>
            {investments.length === 0 && (
              <button
                onClick={openAdd}
                style={{ marginTop: 12, fontSize: 13, padding: "7px 16px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", cursor: "pointer" }}
              >
                + Add first investment
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--color-background-secondary)" }}>
                  {[
                    { label: "Company",      align: "left" as const,   pl: 16 },
                    { label: "Pledged",      align: "right" as const,  pl: undefined },
                    { label: "Invested",     align: "right" as const,  pl: undefined },
                    { label: "Date",         align: "right" as const,  pl: undefined },
                    { label: "Entry Val.",   align: "right" as const,  pl: undefined },
                    { label: "Current Val.", align: "right" as const,  pl: undefined },
                    { label: "ROI",          align: "right" as const,  pl: undefined },
                    { label: "Stage",        align: "center" as const, pl: undefined },
                    { label: "",             align: "center" as const, pl: undefined },
                  ].map((h) => (
                    <th
                      key={h.label}
                      style={{
                        textAlign: h.align,
                        padding: "8px 10px",
                        paddingLeft: h.pl ?? undefined,
                        color: "var(--color-text-secondary)",
                        fontWeight: 500,
                        fontSize: 11,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const m     = moic(inv);
                  const roi   = roiPct(inv);
                  const iv    = impliedValue(inv);
                  const color = sc(inv.stage);
                  const initials = inv.company_name.slice(0, 2).toUpperCase();

                  return (
                    <tr key={inv.id} style={{ borderTop: "0.5px solid var(--color-border-tertiary)" }}>

                      {/* Company */}
                      <td style={{ padding: "11px 10px 11px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: color.bg, color: color.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 600, flexShrink: 0 }}>
                            {initials}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontWeight: 500, color: "var(--color-text-primary)", fontSize: 12.5, whiteSpace: "nowrap" }}>
                              {inv.company_name}
                            </p>
                            {inv.sector && (
                              <p style={{ margin: 0, fontSize: 10.5, color: "var(--color-text-secondary)" }}>
                                {inv.sector}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Pledged = amount committed */}
                      <td style={{ textAlign: "right", padding: "11px 10px", color: "var(--color-text-primary)", fontWeight: 500, whiteSpace: "nowrap" }}>
                        {fmt(Number(inv.amount_invested))}
                      </td>

                      {/* Invested = current implied value */}
                      <td style={{ textAlign: "right", padding: "11px 10px", whiteSpace: "nowrap" }}>
                        {inv.current_valuation ? (
                          <span style={{ color: m !== null && m >= 1 ? "#3B6D11" : m !== null ? "#A32D2D" : "var(--color-text-primary)", fontWeight: 500 }}>
                            {fmt(iv)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--color-text-secondary)" }}>—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td style={{ textAlign: "right", padding: "11px 10px", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                        {new Date(inv.invested_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </td>

                      {/* Entry val */}
                      <td style={{ textAlign: "right", padding: "11px 10px", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                        {inv.entry_valuation ? fmt(Number(inv.entry_valuation)) : "—"}
                      </td>

                      {/* Current val */}
                      <td style={{ textAlign: "right", padding: "11px 10px", fontWeight: inv.current_valuation ? 500 : 400, color: "var(--color-text-primary)", whiteSpace: "nowrap" }}>
                        {inv.current_valuation ? fmt(Number(inv.current_valuation)) : "—"}
                      </td>

                      {/* ROI */}
                      <td style={{ textAlign: "right", padding: "11px 10px", whiteSpace: "nowrap" }}>
                        {roi !== null ? (
                          <span style={{ color: roi >= 0 ? "#3B6D11" : "#A32D2D", fontWeight: 500 }}>
                            {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
                            <span style={{ opacity: 0.65, fontSize: 10.5, marginLeft: 3 }}>
                              ({m!.toFixed(2)}×)
                            </span>
                          </span>
                        ) : (
                          <span style={{ color: "var(--color-text-secondary)" }}>—</span>
                        )}
                      </td>

                      {/* Stage */}
                      <td style={{ textAlign: "center", padding: "11px 10px" }}>
                        {inv.stage ? (
                          <span style={{ background: color.bg, color: color.text, fontSize: 10.5, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
                            {STAGE_LABELS[inv.stage]}
                          </span>
                        ) : (
                          <span style={{ color: "var(--color-text-secondary)" }}>—</span>
                        )}
                      </td>

                      {/* ⋯ context menu */}
                      <td style={{ textAlign: "center", padding: "11px 8px", position: "relative" }}>
                        {deleting === inv.id ? (
                          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>…</span>
                        ) : (
                          <div style={{ position: "relative", display: "inline-block" }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === inv.id ? null : inv.id); }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 17, lineHeight: 1, padding: "2px 6px", borderRadius: 4 }}
                            >
                              ⋯
                            </button>
                            {menuOpen === inv.id && (
                              <div
                                style={{ position: "absolute", right: 0, top: "100%", zIndex: 30, background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.1)", minWidth: 138, overflow: "hidden" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => { openEdit(inv); setMenuOpen(null); }}
                                  style={menuItemSt}
                                >
                                  Edit
                                </button>
                                {inv.source === "deal_room" && inv.deal_room_id && (
                                  <Link
                                    href={`/investor/deal-room/${inv.deal_room_id}`}
                                    style={{ display: "block", padding: "9px 14px", fontSize: 12.5, color: "var(--color-text-primary)", textDecoration: "none", borderTop: "0.5px solid var(--color-border-tertiary)" }}
                                    onClick={() => setMenuOpen(null)}
                                  >
                                    View deal room ↗
                                  </Link>
                                )}
                                <button
                                  onClick={() => handleDelete(inv.id)}
                                  style={{ ...menuItemSt, color: "#A32D2D", borderTop: "0.5px solid var(--color-border-tertiary)" }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer */}
        {investments.length > 0 && (
          <div style={{ padding: "10px 16px", borderTop: "0.5px solid var(--color-border-tertiary)", fontSize: 11.5, color: "var(--color-text-secondary)", display: "flex", justifyContent: "space-between" }}>
            <span>{filtered.length} of {investments.length} investment{investments.length !== 1 ? "s" : ""}</span>
            {investments.some((i) => i.source === "deal_room") && (
              <span>{investments.filter((i) => i.source === "deal_room").length} linked to deal room</span>
            )}
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(12,35,64,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div style={{ background: "var(--color-background-primary)", borderRadius: 16, padding: "24px 28px", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 16px 48px rgba(12,35,64,.2)" }}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: "var(--color-text-primary)" }}>
                {editId ? "Edit investment" : "Add investment"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--color-text-secondary)", lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ background: "#FCEBEB", color: "#791F1F", fontSize: 12.5, padding: "8px 12px", borderRadius: 6, marginBottom: 14 }}>
                {formError}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 14px" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelSt}>Company name *</label>
                <input value={form.company_name} onChange={field("company_name")} placeholder="e.g. NexaFlow AI" style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Sector</label>
                <input value={form.sector} onChange={field("sector")} placeholder="e.g. FinTech" style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Stage</label>
                <select value={form.stage} onChange={field("stage")} style={inputSt}>
                  <option value="">Select stage</option>
                  {STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Amount pledged ($) *</label>
                <input type="number" min="1" value={form.amount_invested} onChange={field("amount_invested")} placeholder="10000" style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Date invested *</label>
                <input type="date" value={form.invested_at} onChange={field("invested_at")} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Entry valuation ($)</label>
                <input type="number" min="0" value={form.entry_valuation} onChange={field("entry_valuation")} placeholder="8000000" style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Current valuation ($)</label>
                <input type="number" min="0" value={form.current_valuation} onChange={field("current_valuation")} placeholder="19000000" style={inputSt} />
              </div>
              {!editId && dealRooms.length > 0 && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelSt}>Link to deal room (optional)</label>
                  <select value={form.deal_room_id} onChange={field("deal_room_id")} style={inputSt}>
                    <option value="">No deal room — self-reported</option>
                    {dealRooms.map((dr) => <option key={dr.id} value={dr.id}>{dr.title}</option>)}
                  </select>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--color-text-secondary)" }}>
                    Linking marks this as a platform deal room investment.
                  </p>
                </div>
              )}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelSt}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={field("notes")}
                  placeholder="Any notes about this deal…"
                  rows={2}
                  style={{ ...inputSt, resize: "vertical" as const }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button
                onClick={() => setShowForm(false)}
                style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, background: "none", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Saving…" : editId ? "Save changes" : "Add investment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── shared styles ── */
const cardSt: React.CSSProperties = {
  background: "var(--color-background-secondary)",
  borderRadius: "var(--border-radius-md)",
  padding: "14px 16px",
};
const cardLabel: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 500,
  color: "var(--color-text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: "0 0 4px",
};
const cardValue: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 500,
  margin: 0,
  color: "var(--color-text-primary)",
  lineHeight: 1.2,
};
const cardSub: React.CSSProperties = {
  fontSize: 11,
  color: "var(--color-text-secondary)",
  margin: "4px 0 0",
};
const menuItemSt: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "9px 14px",
  fontSize: 12.5,
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--color-text-primary)",
};
const labelSt: React.CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 500,
  color: "var(--color-text-secondary)",
  marginBottom: 4,
};
const inputSt: React.CSSProperties = {
  width: "100%",
  fontSize: 13,
  padding: "7px 10px",
  borderRadius: 7,
  border: "0.5px solid var(--color-border-secondary)",
  background: "var(--color-background-secondary)",
  color: "var(--color-text-primary)",
  boxSizing: "border-box",
};
