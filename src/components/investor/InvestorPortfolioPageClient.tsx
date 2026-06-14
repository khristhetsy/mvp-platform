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

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/* ── CSV export ── */
function exportCSV(investments: PortfolioInvestment[]) {
  const headers = [
    "Company", "Sector", "Pledged", "Entry Val.", "Current Val.",
    "ROI %", "MOIC", "Stage", "Date", "Source", "Notes",
  ];
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
const STAGES = Object.entries(STAGE_LABELS) as [InvestmentStage, string][];

/* ── shared input styles ── */
const labelCls = "block text-[11.5px] font-medium text-slate-500 mb-1";
const inputCls =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900 focus:outline-none";

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
      list = list.filter(
        (i) => i.company_name.toLowerCase().includes(q) || (i.sector ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [investments, tab, search]);

  /* stat aggregates */
  const totalPledge = investments.reduce((s, i) => s + Number(i.amount_invested), 0);
  const totalValue  = investments.reduce((s, i) => s + impliedValue(i), 0);
  const totalRoi    = totalValue - totalPledge;
  const totalRoiPct = totalPledge > 0 ? (totalRoi / totalPledge) * 100 : 0;

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
    if (!form.company_name.trim())                               { setFormError("Company name is required."); return; }
    if (!form.amount_invested || Number(form.amount_invested) <= 0) { setFormError("Amount must be positive."); return; }
    if (!form.invested_at)                                       { setFormError("Investment date is required."); return; }

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
    <div>
      {/* ── Stat row ── */}
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-200 pb-5">
        {[
          { label: "Total pledge",   value: fmt(totalPledge),  color: "" },
          { label: "Portfolio value", value: fmt(totalValue),   color: "" },
          {
            label: "Total ROI",
            value: totalPledge > 0 ? `${totalRoiPct >= 0 ? "+" : ""}${totalRoiPct.toFixed(1)}%` : "—",
            color: totalPledge > 0 ? (totalRoiPct >= 0 ? "text-emerald-600" : "text-red-600") : "",
          },
          { label: "Deals", value: String(investments.length), color: "" },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5">
            <span className={`text-xl font-semibold leading-none ${s.color || "text-slate-900"}`}>
              {s.value}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Filter tabs */}
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {(["all", "active", "exited", "written_off"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                tab === t
                  ? "border border-slate-200 bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "all" ? "All" : t === "written_off" ? "Written off" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search portfolio…"
          className="min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />

        {/* Export */}
        <button
          type="button"
          onClick={() => exportCSV(investments)}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          Export CSV
        </button>

        {/* Add */}
        <button
          type="button"
          onClick={openAdd}
          className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          + Add investment
        </button>
      </div>

      {/* ── Section label ── */}
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Portfolio · {filtered.length} {filtered.length === 1 ? "investment" : "investments"}
      </p>

      {/* ── Table ── */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">Loading investments…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-sm text-slate-500">
            {investments.length === 0
              ? "No investments logged yet. Add your first deal to start tracking."
              : "No deals match the current filter."}
          </p>
          {investments.length === 0 && (
            <button
              type="button"
              onClick={openAdd}
              className="mt-3 rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              + Add first investment
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2.5 text-left text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                  Company
                </th>
                <th className="px-4 py-2.5 text-left text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                  Sector
                </th>
                <th className="px-4 py-2.5 text-left text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                  Stage
                </th>
                <th className="px-4 py-2.5 text-right text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                  Date
                </th>
                <th className="px-4 py-2.5 text-right text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                  Pledged
                </th>
                <th className="px-4 py-2.5 text-right text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                  Entry val.
                </th>
                <th className="px-4 py-2.5 text-right text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                  Current val.
                </th>
                <th className="px-4 py-2.5 text-right text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                  ROI
                </th>
                <th className="px-4 py-2.5 text-right text-[9.5px] font-semibold uppercase tracking-wide text-slate-400" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((inv) => {
                const m   = moic(inv);
                const roi = roiPct(inv);
                const iv  = impliedValue(inv);

                return (
                  <tr key={inv.id} className="transition-colors hover:bg-slate-50/60">
                    {/* Company */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500">
                          {initials(inv.company_name)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{inv.company_name}</p>
                          {inv.source === "deal_room" && (
                            <p className="mt-0.5 text-[10px] font-medium text-indigo-500">
                              Platform deal
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Sector */}
                    <td className="px-4 py-3">
                      {inv.sector ? (
                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-600">
                          {inv.sector}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>

                    {/* Stage */}
                    <td className="px-4 py-3">
                      {inv.stage ? (
                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-600">
                          {STAGE_LABELS[inv.stage]}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-500">
                      {formatDate(inv.invested_at)}
                    </td>

                    {/* Pledged */}
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-slate-900">
                      {fmt(Number(inv.amount_invested))}
                    </td>

                    {/* Entry val */}
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-500">
                      {inv.entry_valuation ? (
                        fmt(Number(inv.entry_valuation))
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Current val */}
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                      {inv.current_valuation ? (
                        <span
                          className={
                            m !== null && m >= 1
                              ? "font-semibold text-emerald-600"
                              : m !== null
                              ? "font-semibold text-red-600"
                              : "text-slate-900"
                          }
                        >
                          {fmt(iv)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* ROI */}
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                      {roi !== null ? (
                        <span
                          className={
                            roi >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"
                          }
                        >
                          {roi >= 0 ? "+" : ""}
                          {roi.toFixed(1)}%
                          <span className="ml-1 font-normal opacity-60">({m!.toFixed(2)}×)</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* ⋯ context menu */}
                    <td className="px-4 py-3 text-right">
                      {deleting === inv.id ? (
                        <span className="text-xs text-slate-400">…</span>
                      ) : (
                        <div className="relative inline-block">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpen(menuOpen === inv.id ? null : inv.id);
                            }}
                            className="rounded-md border border-transparent px-2 py-1 text-base text-slate-400 hover:border-slate-200 hover:bg-slate-50"
                          >
                            ⋯
                          </button>
                          {menuOpen === inv.id && (
                            <div
                              className="absolute right-0 top-full z-30 min-w-[138px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => { openEdit(inv); setMenuOpen(null); }}
                                className="block w-full px-4 py-2.5 text-left text-[12.5px] text-slate-700 hover:bg-slate-50"
                              >
                                Edit
                              </button>
                              {inv.source === "deal_room" && inv.deal_room_id && (
                                <Link
                                  href={`/investor/deal-room/${inv.deal_room_id}`}
                                  className="block border-t border-slate-100 px-4 py-2.5 text-[12.5px] text-slate-700 hover:bg-slate-50"
                                  onClick={() => setMenuOpen(null)}
                                >
                                  View deal room ↗
                                </Link>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDelete(inv.id)}
                                className="block w-full border-t border-slate-100 px-4 py-2.5 text-left text-[12.5px] text-red-600 hover:bg-red-50"
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

          {/* Table footer */}
          <div className="flex justify-between border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-400">
            <span>
              {filtered.length} of {investments.length} investment{investments.length !== 1 ? "s" : ""}
            </span>
            {investments.some((i) => i.source === "deal_room") && (
              <span>
                {investments.filter((i) => i.source === "deal_room").length} linked to deal room
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0c2340]/50 p-5"
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-2xl bg-white p-7 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {editId ? "Edit investment" : "Add investment"}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-lg leading-none text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-3.5 gap-y-3">
              <div className="col-span-2">
                <label className={labelCls}>Company name *</label>
                <input
                  value={form.company_name}
                  onChange={field("company_name")}
                  placeholder="e.g. NexaFlow AI"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Sector</label>
                <input
                  value={form.sector}
                  onChange={field("sector")}
                  placeholder="e.g. FinTech"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Stage</label>
                <select value={form.stage} onChange={field("stage")} className={inputCls}>
                  <option value="">Select stage</option>
                  {STAGES.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Amount pledged ($) *</label>
                <input
                  type="number"
                  min="1"
                  value={form.amount_invested}
                  onChange={field("amount_invested")}
                  placeholder="10000"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Date invested *</label>
                <input
                  type="date"
                  value={form.invested_at}
                  onChange={field("invested_at")}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Entry valuation ($)</label>
                <input
                  type="number"
                  min="0"
                  value={form.entry_valuation}
                  onChange={field("entry_valuation")}
                  placeholder="8000000"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Current valuation ($)</label>
                <input
                  type="number"
                  min="0"
                  value={form.current_valuation}
                  onChange={field("current_valuation")}
                  placeholder="19000000"
                  className={inputCls}
                />
              </div>
              {!editId && dealRooms.length > 0 && (
                <div className="col-span-2">
                  <label className={labelCls}>Link to deal room (optional)</label>
                  <select value={form.deal_room_id} onChange={field("deal_room_id")} className={inputCls}>
                    <option value="">No deal room — self-reported</option>
                    {dealRooms.map((dr) => (
                      <option key={dr.id} value={dr.id}>{dr.title}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Linking marks this as a platform deal room investment.
                  </p>
                </div>
              )}
              <div className="col-span-2">
                <label className={labelCls}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={field("notes")}
                  placeholder="Any notes about this deal…"
                  rows={2}
                  className={`${inputCls} resize-y`}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-60"
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
