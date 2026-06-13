"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import type {
  PortfolioInvestment,
  CreateInvestmentInput,
  UpdateInvestmentInput,
  InvestmentStage,
} from "@/lib/portfolio/types";
import { STAGE_LABELS } from "@/lib/portfolio/types";

/* ── helpers ── */
const fmt = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : `$${n.toLocaleString()}`;

function moic(inv: PortfolioInvestment): number | null {
  if (!inv.current_valuation || !inv.entry_valuation || inv.entry_valuation === 0)
    return null;
  return Number(inv.current_valuation) / Number(inv.entry_valuation);
}

function impliedValue(inv: PortfolioInvestment): number {
  const m = moic(inv);
  if (m === null) return Number(inv.amount_invested);
  return Number(inv.amount_invested) * m;
}

function stageColor(stage: InvestmentStage | null) {
  switch (stage) {
    case "pre_seed":   return { bg: "#EEEDFE", color: "#3C3489" };
    case "seed":       return { bg: "#EEEDFE", color: "#3C3489" };
    case "series_a":   return { bg: "#E6F1FB", color: "#0C447C" };
    case "series_b":   return { bg: "#E6F1FB", color: "#0C447C" };
    case "growth":     return { bg: "#EAF3DE", color: "#27500A" };
    case "ipo":        return { bg: "#EAF3DE", color: "#27500A" };
    case "exited":     return { bg: "#E1F5EE", color: "#085041" };
    case "written_off":return { bg: "#FCEBEB", color: "#791F1F" };
    default:           return { bg: "#F1EFE8", color: "#444441" };
  }
}

const STAGES = Object.entries(STAGE_LABELS) as [InvestmentStage, string][];

/* ── add/edit form ── */
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
  company_name: "",
  sector: "",
  amount_invested: "",
  entry_valuation: "",
  current_valuation: "",
  stage: "",
  invested_at: "",
  notes: "",
  deal_room_id: "",
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

  const [menuOpen, setMenuOpen]   = useState<string | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);

  /* fetch */
  useEffect(() => {
    Promise.all([
      fetch("/api/investor/portfolio-investments").then((r) => r.json()),
      fetch("/api/investor/deal-room").then((r) => r.json()),
    ]).then(([inv, dr]) => {
      setInvestments(Array.isArray(inv) ? inv : []);
      setDealRooms(Array.isArray(dr?.rooms) ? dr.rooms : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  /* filtered list */
  const filtered = useMemo(() => {
    let list = investments;
    if (tab === "active")     list = list.filter((i) => i.stage !== "exited" && i.stage !== "written_off");
    if (tab === "exited")     list = list.filter((i) => i.stage === "exited");
    if (tab === "written_off")list = list.filter((i) => i.stage === "written_off");
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) => i.company_name.toLowerCase().includes(q) || (i.sector ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [investments, tab, search]);

  /* stat aggregates */
  const totalInvested   = investments.reduce((s, i) => s + Number(i.amount_invested), 0);
  const totalValue      = investments.reduce((s, i) => s + impliedValue(i), 0);
  const totalReturn     = totalValue - totalInvested;
  const stages          = [...new Set(investments.map((i) => i.stage).filter(Boolean))];

  /* form helpers */
  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(inv: PortfolioInvestment) {
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
  }

  async function handleSave() {
    setFormError("");
    if (!form.company_name.trim()) { setFormError("Company name is required."); return; }
    if (!form.amount_invested || Number(form.amount_invested) <= 0) { setFormError("Amount must be positive."); return; }
    if (!form.invested_at) { setFormError("Investment date is required."); return; }

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

  const f = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  /* ── render ── */
  return (
    <div style={{ fontFamily: "var(--font-sans)" }}>
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total invested", value: fmt(totalInvested), sub: `${investments.length} deals` },
          {
            label: "Portfolio value",
            value: fmt(totalValue),
            sub: totalInvested > 0
              ? `${totalReturn >= 0 ? "+" : ""}${((totalReturn / totalInvested) * 100).toFixed(1)}% unrealized`
              : "—",
            subColor: totalReturn >= 0 ? "#3B6D11" : "#A32D2D",
          },
          {
            label: "Unrealized gain",
            value: `${totalReturn >= 0 ? "+" : ""}${fmt(Math.abs(totalReturn))}`,
            sub: "vs. cost basis",
            valueColor: totalReturn >= 0 ? "#3B6D11" : "#A32D2D",
          },
          {
            label: "Stage mix",
            value: stages.length > 0 ? `${stages.length} stage${stages.length > 1 ? "s" : ""}` : "—",
            sub: stages.map((s) => STAGE_LABELS[s as InvestmentStage]).join(" · ") || "No investments yet",
          },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              background: "var(--color-background-secondary)",
              borderRadius: "var(--border-radius-md)",
              padding: "14px 16px",
            }}
          >
            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 4px" }}>
              {card.label}
            </p>
            <p style={{ fontSize: 20, fontWeight: 500, margin: 0, color: (card as { valueColor?: string }).valueColor ?? "var(--color-text-primary)" }}>
              {card.value}
            </p>
            <p style={{ fontSize: 11, color: (card as { subColor?: string }).subColor ?? "var(--color-text-secondary)", margin: "4px 0 0" }}>
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div
        style={{
          background: "var(--color-background-primary)",
          border: "0.5px solid var(--color-border-tertiary)",
          borderRadius: "var(--border-radius-lg)",
          overflow: "hidden",
        }}
      >
        {/* Toolbar */}
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
          <div style={{ display: "flex", gap: 6, flex: 1 }}>
            {(["all", "active", "exited", "written_off"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
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
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals…"
            style={{
              fontSize: 12,
              padding: "5px 10px",
              borderRadius: 6,
              border: "0.5px solid var(--color-border-tertiary)",
              background: "var(--color-background-secondary)",
              color: "var(--color-text-primary)",
              width: 160,
            }}
          />
          <button
            onClick={openAdd}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              padding: "5px 12px",
              borderRadius: 6,
              background: "#534AB7",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontWeight: 500,
            }}
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
                  {["Company", "Invested", "Date", "Entry val.", "Current val.", "Return", "Stage", "Source", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === "Company" ? "left" : h === "" ? "center" : "right",
                        padding: h === "Company" ? "8px 16px" : "8px 10px",
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
                  const m = moic(inv);
                  const iv = impliedValue(inv);
                  const sc = stageColor(inv.stage);
                  const initials = inv.company_name.slice(0, 2).toUpperCase();
                  return (
                    <tr
                      key={inv.id}
                      style={{ borderTop: "0.5px solid var(--color-border-tertiary)" }}
                    >
                      {/* Company */}
                      <td style={{ padding: "11px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <div
                            style={{
                              width: 28, height: 28, borderRadius: 6,
                              background: sc.bg, color: sc.color,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 10.5, fontWeight: 500, flexShrink: 0,
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontWeight: 500, color: "var(--color-text-primary)", fontSize: 12.5 }}>
                              {inv.company_name}
                            </p>
                            {inv.sector && (
                              <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-secondary)" }}>
                                {inv.sector}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Invested */}
                      <td style={{ textAlign: "right", padding: "11px 10px", color: "var(--color-text-primary)" }}>
                        {fmt(Number(inv.amount_invested))}
                      </td>
                      {/* Date */}
                      <td style={{ textAlign: "right", padding: "11px 10px", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                        {new Date(inv.invested_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </td>
                      {/* Entry val */}
                      <td style={{ textAlign: "right", padding: "11px 10px", color: "var(--color-text-secondary)" }}>
                        {inv.entry_valuation ? fmt(Number(inv.entry_valuation)) : "—"}
                      </td>
                      {/* Current val */}
                      <td style={{ textAlign: "right", padding: "11px 10px", fontWeight: 500, color: "var(--color-text-primary)" }}>
                        {inv.current_valuation ? fmt(iv) : "—"}
                      </td>
                      {/* Return multiple */}
                      <td style={{ textAlign: "right", padding: "11px 10px" }}>
                        {m !== null ? (
                          <span style={{ color: m >= 1 ? "#3B6D11" : "#A32D2D", fontWeight: 500 }}>
                            {m >= 1 ? "+" : ""}{m.toFixed(2)}×
                          </span>
                        ) : (
                          <span style={{ color: "var(--color-text-secondary)" }}>—</span>
                        )}
                      </td>
                      {/* Stage */}
                      <td style={{ textAlign: "center", padding: "11px 10px" }}>
                        {inv.stage ? (
                          <span
                            style={{
                              background: sc.bg,
                              color: sc.color,
                              fontSize: 10.5,
                              padding: "2px 8px",
                              borderRadius: 999,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {STAGE_LABELS[inv.stage]}
                          </span>
                        ) : (
                          <span style={{ color: "var(--color-text-secondary)" }}>—</span>
                        )}
                      </td>
                      {/* Source */}
                      <td style={{ textAlign: "center", padding: "11px 10px" }}>
                        {inv.source === "deal_room" ? (
                          <Link
                            href={`/investor/deal-room/${inv.deal_room_id}`}
                            style={{
                              background: "#E1F5EE",
                              color: "#085041",
                              fontSize: 10.5,
                              padding: "2px 8px",
                              borderRadius: 999,
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Deal room ↗
                          </Link>
                        ) : (
                          <span style={{ background: "#FAEEDA", color: "#633806", fontSize: 10.5, padding: "2px 8px", borderRadius: 999 }}>
                            Self-reported
                          </span>
                        )}
                      </td>
                      {/* Actions */}
                      <td style={{ textAlign: "center", padding: "11px 8px", position: "relative" }}>
                        {deleting === inv.id ? (
                          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>…</span>
                        ) : (
                          <div style={{ position: "relative", display: "inline-block" }}>
                            <button
                              onClick={() => setMenuOpen(menuOpen === inv.id ? null : inv.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 16, lineHeight: 1, padding: "2px 6px", borderRadius: 4 }}
                            >
                              ⋯
                            </button>
                            {menuOpen === inv.id && (
                              <div
                                style={{
                                  position: "absolute",
                                  right: 0,
                                  top: "100%",
                                  zIndex: 20,
                                  background: "var(--color-background-primary)",
                                  border: "0.5px solid var(--color-border-secondary)",
                                  borderRadius: 8,
                                  boxShadow: "0 4px 16px rgba(0,0,0,.08)",
                                  minWidth: 120,
                                  overflow: "hidden",
                                }}
                              >
                                <button
                                  onClick={() => { openEdit(inv); setMenuOpen(null); }}
                                  style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", fontSize: 12.5, background: "none", border: "none", cursor: "pointer", color: "var(--color-text-primary)" }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(inv.id)}
                                  style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", fontSize: 12.5, background: "none", border: "none", cursor: "pointer", color: "#A32D2D" }}
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

        {/* Footer */}
        {investments.length > 0 && (
          <div
            style={{
              padding: "10px 16px",
              borderTop: "0.5px solid var(--color-border-tertiary)",
              fontSize: 11.5,
              color: "var(--color-text-secondary)",
            }}
          >
            {filtered.length} of {investments.length} investment{investments.length !== 1 ? "s" : ""}
            {investments.some((i) => i.source === "deal_room") && (
              <span> · {investments.filter((i) => i.source === "deal_room").length} linked to deal room</span>
            )}
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal overlay ── */}
      {showForm && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            background: "rgba(12,35,64,.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "var(--color-background-primary)",
              borderRadius: 16,
              padding: "24px 28px",
              width: "100%",
              maxWidth: 520,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
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
              {/* Company name — full width */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelSt}>Company name *</label>
                <input value={form.company_name} onChange={f("company_name")} placeholder="e.g. NexaFlow AI" style={inputSt} />
              </div>
              {/* Sector */}
              <div>
                <label style={labelSt}>Sector</label>
                <input value={form.sector} onChange={f("sector")} placeholder="e.g. FinTech" style={inputSt} />
              </div>
              {/* Stage */}
              <div>
                <label style={labelSt}>Stage</label>
                <select value={form.stage} onChange={f("stage")} style={inputSt}>
                  <option value="">Select stage</option>
                  {STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {/* Amount invested */}
              <div>
                <label style={labelSt}>Amount invested ($) *</label>
                <input type="number" min="1" value={form.amount_invested} onChange={f("amount_invested")} placeholder="10000" style={inputSt} />
              </div>
              {/* Date */}
              <div>
                <label style={labelSt}>Date invested *</label>
                <input type="date" value={form.invested_at} onChange={f("invested_at")} style={inputSt} />
              </div>
              {/* Entry valuation */}
              <div>
                <label style={labelSt}>Entry valuation ($)</label>
                <input type="number" min="0" value={form.entry_valuation} onChange={f("entry_valuation")} placeholder="8000000" style={inputSt} />
              </div>
              {/* Current valuation */}
              <div>
                <label style={labelSt}>Current valuation ($)</label>
                <input type="number" min="0" value={form.current_valuation} onChange={f("current_valuation")} placeholder="19000000" style={inputSt} />
              </div>
              {/* Link to deal room — only for new */}
              {!editId && dealRooms.length > 0 && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelSt}>Link to deal room (optional)</label>
                  <select value={form.deal_room_id} onChange={f("deal_room_id")} style={inputSt}>
                    <option value="">No deal room — self-reported</option>
                    {dealRooms.map((dr) => (
                      <option key={dr.id} value={dr.id}>{dr.title}</option>
                    ))}
                  </select>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--color-text-secondary)" }}>
                    Linking to a deal room marks this as a platform-linked investment.
                  </p>
                </div>
              )}
              {/* Notes */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelSt}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={f("notes")}
                  placeholder="Any notes about the deal…"
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
