"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type {
  PortfolioInvestment,
  CreateInvestmentInput,
  UpdateInvestmentInput,
  InvestmentStage,
  PortfolioStatus,
  PledgeRecord,
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
  if (!inv.current_valuation || !inv.entry_valuation || Number(inv.entry_valuation) === 0) return null;
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
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}
function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}
function fmtCurrency(amount: number | null, currency = "USD") {
  if (!amount) return "—";
  return currency === "USD" ? fmt(amount) : `${fmt(amount)} ${currency}`;
}

/* ── CSV export ── */
function exportCSV(investments: PortfolioInvestment[]) {
  const headers = [
    "Company", "Status", "Sector", "Amount", "Entry Val.", "Current Val.",
    "ROI %", "MOIC", "Stage", "Date", "Source", "Notes",
  ];
  const rows = investments.map((inv) => {
    const r = roiPct(inv);
    const m = moic(inv);
    return [
      `"${inv.company_name}"`, inv.status, `"${inv.sector ?? ""}"`,
      inv.amount_invested, inv.entry_valuation ?? "", inv.current_valuation ?? "",
      r !== null ? `${r.toFixed(1)}%` : "", m !== null ? `${m.toFixed(2)}x` : "",
      inv.stage ? STAGE_LABELS[inv.stage] : "", inv.invested_at, inv.source,
      `"${(inv.notes ?? "").replace(/"/g, "'")}"`,
    ].join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "portfolio.csv"; a.click();
  URL.revokeObjectURL(url);
}

/* ── form state ── */
interface FormState {
  company_name: string; sector: string; amount_invested: string;
  entry_valuation: string; current_valuation: string;
  stage: InvestmentStage | ""; status: PortfolioStatus;
  invested_at: string; notes: string; deal_room_id: string;
  company_id: string; company_slug: string; interest_id: string;
}
const EMPTY_FORM: FormState = {
  company_name: "", sector: "", amount_invested: "", entry_valuation: "",
  current_valuation: "", stage: "", status: "invested",
  invested_at: "", notes: "", deal_room_id: "",
  company_id: "", company_slug: "", interest_id: "",
};

type DealRoomOption = { id: string; title: string };
const STAGES = Object.entries(STAGE_LABELS) as [InvestmentStage, string][];

const STATUS_META: Record<PortfolioStatus, { label: string; pill: string; dot: string }> = {
  invested:  { label: "Invested",  pill: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  committed: { label: "Committed", pill: "bg-blue-50 text-blue-700",       dot: "bg-blue-500" },
  tracking:  { label: "Tracking",  pill: "bg-amber-50 text-amber-700",     dot: "bg-amber-400" },
};

const labelCls = "block text-[11.5px] font-medium text-slate-500 mb-1";
const inputCls =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900 focus:outline-none";

/* ════════════════════════════════════════════════════════ */
export function InvestorPortfolioPageClient() {
  const t = useTranslations("investorCmp");
  const searchParams = useSearchParams();

  const [investments, setInvestments] = useState<PortfolioInvestment[]>([]);
  const [pledges, setPledges]         = useState<PledgeRecord[]>([]);
  const [dealRooms, setDealRooms]     = useState<DealRoomOption[]>([]);
  const [loading, setLoading]         = useState(true);

  const [tab, setTab]       = useState<PortfolioStatus>("invested");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [form, setForm]           = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");

  const [menuOpen, setMenuOpen]   = useState<string | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [converting, setConverting] = useState<string | null>(null);

  /* fetch on mount */
  useEffect(() => {
    Promise.all([
      fetch("/api/investor/portfolio-investments").then((r) => r.json()),
      fetch("/api/investor/portfolio-investments/pledges").then((r) => r.json()),
      fetch("/api/investor/deal-room").then((r) => r.json()),
    ])
      .then(([inv, pl, dr]) => {
        setInvestments(Array.isArray(inv) ? inv : []);
        setPledges(Array.isArray(pl) ? pl : []);
        setDealRooms(Array.isArray(dr?.rooms) ? dr.rooms : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  /* handle ?add_company_id=&company_name=&slug=&interest_id=&pledge_amount= from Opportunities page */
  useEffect(() => {
    const cname = searchParams?.get("company_name");
    if (!cname) return;
    const cid  = searchParams?.get("add_company_id") ?? "";
    const slug = searchParams?.get("slug") ?? "";
    const iid  = searchParams?.get("interest_id") ?? "";
    const amt  = searchParams?.get("pledge_amount") ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      ...EMPTY_FORM,
      company_id:      cid,
      company_name:    cname,
      company_slug:    slug,
      interest_id:     iid,
      amount_invested: amt,
      status:          iid ? "committed" : "tracking",
      invested_at:     new Date().toISOString().slice(0, 10),
    });
    setEditId(null);
    setFormError("");
    setShowForm(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* close context menu on outside click */
  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(null);
    const timer = setTimeout(() => document.addEventListener("click", handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener("click", handler); };
  }, [menuOpen]);

  /* pledges not yet linked to a portfolio entry */
  const unlinkedPledges = useMemo(() => {
    const linkedIds        = new Set(investments.map((i) => i.interest_id).filter(Boolean));
    const linkedCompanyIds = new Set(investments.map((i) => i.company_id).filter(Boolean));
    return pledges.filter(
      (p) => !linkedIds.has(p.id) && !(p.company_id && linkedCompanyIds.has(p.company_id))
    );
  }, [investments, pledges]);

  /* per-tab lists */
  const investedList  = useMemo(() => investments.filter((i) => (i.status ?? "invested") === "invested"),  [investments]);
  const committedList = useMemo(() => investments.filter((i) => i.status === "committed"), [investments]);
  const trackingList  = useMemo(() => investments.filter((i) => i.status === "tracking"),  [investments]);

  const applySearch = <T extends { company_name: string; sector?: string | null }>(list: T[]) =>
    search
      ? list.filter(
          (i) =>
            i.company_name.toLowerCase().includes(search.toLowerCase()) ||
            (i.sector ?? "").toLowerCase().includes(search.toLowerCase())
        )
      : list;

  /* stats */
  const totalDeployed  = investedList.reduce((s, i) => s + Number(i.amount_invested), 0);
  const totalCommitted =
    committedList.reduce((s, i) => s + Number(i.amount_invested), 0) +
    unlinkedPledges.reduce((s, p) => s + Number(p.pledge_amount ?? 0), 0);
  const totalValue     = investedList.reduce((s, i) => s + impliedValue(i), 0);
  const totalRoiPct    = totalDeployed > 0 ? ((totalValue - totalDeployed) / totalDeployed) * 100 : 0;

  /* ── form openers ── */
  const openAdd = useCallback((prefill?: Partial<FormState>) => {
    setEditId(null);
    setForm({ ...EMPTY_FORM, invested_at: new Date().toISOString().slice(0, 10), ...prefill });
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
      status:            inv.status ?? "invested",
      invested_at:       inv.invested_at.slice(0, 10),
      notes:             inv.notes ?? "",
      deal_room_id:      inv.deal_room_id ?? "",
      company_id:        inv.company_id ?? "",
      company_slug:      inv.company_slug ?? "",
      interest_id:       inv.interest_id ?? "",
    });
    setFormError("");
    setShowForm(true);
  }, []);

  /* ── convert pledge → portfolio entry ── */
  const convertPledge = useCallback(async (pledge: PledgeRecord, toStatus: PortfolioStatus) => {
    setConverting(pledge.id);
    try {
      const body: CreateInvestmentInput = {
        company_id:      pledge.company_id ?? undefined,
        company_name:    pledge.company_name,
        company_slug:    pledge.company_slug ?? undefined,
        interest_id:     pledge.id,
        amount_invested: Number(pledge.pledge_amount ?? 0),
        status:          toStatus,
        invested_at:     new Date().toISOString().slice(0, 10),
      };
      const res = await fetch("/api/investor/portfolio-investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const created: PortfolioInvestment = await res.json();
      setInvestments((prev) => [created, ...prev]);
      setTab(toStatus);
    } catch { /* silent */ }
    finally { setConverting(null); }
  }, []);

  /* ── save ── */
  async function handleSave() {
    setFormError("");
    if (!form.company_name.trim()) { setFormError("Company name is required."); return; }
    const needsAmount = form.status === "invested" || form.status === "committed";
    if (needsAmount && (!form.amount_invested || Number(form.amount_invested) < 0)) {
      setFormError("Amount must be a positive number."); return;
    }
    if (!form.invested_at) { setFormError("Date is required."); return; }

    setSaving(true);
    try {
      if (editId) {
        const body: UpdateInvestmentInput = {
          company_name:      form.company_name,
          sector:            form.sector || null,
          amount_invested:   Number(form.amount_invested) || 0,
          entry_valuation:   form.entry_valuation  ? Number(form.entry_valuation)  : null,
          current_valuation: form.current_valuation ? Number(form.current_valuation) : null,
          stage:             (form.stage as InvestmentStage) || null,
          status:            form.status,
          invested_at:       form.invested_at,
          notes:             form.notes || null,
        };
        const res = await fetch(`/api/investor/portfolio-investments/${editId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Update failed");
        const updated: PortfolioInvestment = await res.json();
        setInvestments((prev) => prev.map((i) => (i.id === editId ? updated : i)));
      } else {
        const body: CreateInvestmentInput = {
          company_name:      form.company_name,
          sector:            form.sector || null,
          amount_invested:   Number(form.amount_invested) || 0,
          entry_valuation:   form.entry_valuation  ? Number(form.entry_valuation)  : null,
          current_valuation: form.current_valuation ? Number(form.current_valuation) : null,
          stage:             (form.stage as InvestmentStage) || null,
          status:            form.status,
          company_id:        form.company_id   || null,
          company_slug:      form.company_slug || null,
          interest_id:       form.interest_id  || null,
          invested_at:       form.invested_at,
          notes:             form.notes || null,
          deal_room_id:      form.deal_room_id || null,
        };
        const res = await fetch("/api/investor/portfolio-investments", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Create failed");
        const created: PortfolioInvestment = await res.json();
        setInvestments((prev) => [created, ...prev]);
        setTab(form.status);
      }
      setShowForm(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Something went wrong.");
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setDeleting(id); setMenuOpen(null);
    try {
      await fetch(`/api/investor/portfolio-investments/${id}`, { method: "DELETE" });
      setInvestments((prev) => prev.filter((i) => i.id !== id));
    } finally { setDeleting(null); }
  }

  const field = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  /* ── mark as invested (inline) ── */
  async function markAsInvested(inv: PortfolioInvestment) {
    setMenuOpen(null);
    const res = await fetch(`/api/investor/portfolio-investments/${inv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "invested" }),
    });
    if (res.ok) {
      const updated = await res.json();
      setInvestments((p) => p.map((i) => (i.id === inv.id ? updated : i)));
      setTab("invested");
    }
  }

  /* ══════════════════════════════════════════════════════ */
  /* ── Investment table row ── */
  function InvestmentRow({ inv }: { inv: PortfolioInvestment }) {
    const m   = moic(inv);
    const roi = roiPct(inv);
    const iv  = impliedValue(inv);
    const meta = STATUS_META[inv.status ?? "invested"];

    return (
      <tr className="transition-colors hover:bg-slate-50/60">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500">
              {initials(inv.company_name)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-900">{inv.company_name}</p>
                {inv.company_slug && (
                  <Link
                    href={`/investor/opportunities`}
                    className="text-[10px] font-medium text-[#2E78F5] hover:underline"
                  >↗ View</Link>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${meta.pill}`}>
                  {meta.label}
                </span>
                {inv.source === "deal_room" && (
                  <span className="text-[9.5px] font-medium text-[#2E78F5]">{t("platform_deal")}</span>
                )}
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          {inv.sector ? (
            <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-600">{inv.sector}</span>
          ) : <span className="text-xs text-slate-300">—</span>}
        </td>
        <td className="px-4 py-3">
          {inv.stage ? (
            <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-600">{STAGE_LABELS[inv.stage]}</span>
          ) : <span className="text-xs text-slate-300">—</span>}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-500">
          {formatDate(inv.invested_at)}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-slate-900">
          {Number(inv.amount_invested) > 0 ? fmt(Number(inv.amount_invested)) : <span className="text-slate-300">—</span>}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-500">
          {inv.entry_valuation ? fmt(Number(inv.entry_valuation)) : <span className="text-slate-300">—</span>}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
          {inv.current_valuation ? (
            <span className={m !== null && m >= 1 ? "font-semibold text-emerald-600" : m !== null ? "font-semibold text-red-600" : "text-slate-900"}>
              {fmt(iv)}
            </span>
          ) : <span className="text-slate-300">—</span>}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
          {roi !== null ? (
            <span className={roi >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
              {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
              <span className="ml-1 font-normal opacity-60">({m!.toFixed(2)}×)</span>
            </span>
          ) : <span className="text-slate-300">—</span>}
        </td>
        <td className="px-4 py-3 text-right">
          {deleting === inv.id ? (
            <span className="text-xs text-slate-400">…</span>
          ) : (
            <div className="relative inline-block">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === inv.id ? null : inv.id); }}
                className="rounded-md border border-transparent px-2 py-1 text-base text-slate-400 hover:border-slate-200 hover:bg-slate-50"
              >⋯</button>
              {menuOpen === inv.id && (
                <div
                  className="absolute right-0 top-full z-30 min-w-[160px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => { openEdit(inv); setMenuOpen(null); }}
                    className="block w-full px-4 py-2.5 text-left text-[12.5px] text-slate-700 hover:bg-slate-50"
                  >{t("edit")}</button>
                  {(inv.status === "committed" || inv.status === "tracking") && (
                    <button
                      type="button"
                      onClick={() => void markAsInvested(inv)}
                      className="block w-full border-t border-slate-100 px-4 py-2.5 text-left text-[12.5px] text-emerald-700 hover:bg-emerald-50"
                    >{t("mark_as_invested")}</button>
                  )}
                  {inv.source === "deal_room" && inv.deal_room_id && (
                    <Link
                      href={`/investor/deal-room/${inv.deal_room_id}`}
                      className="block border-t border-slate-100 px-4 py-2.5 text-[12.5px] text-slate-700 hover:bg-slate-50"
                      onClick={() => setMenuOpen(null)}
                    >View deal room ↗</Link>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDelete(inv.id)}
                    className="block w-full border-t border-slate-100 px-4 py-2.5 text-left text-[12.5px] text-red-600 hover:bg-red-50"
                  >{t("delete")}</button>
                </div>
              )}
            </div>
          )}
        </td>
      </tr>
    );
  }

  /* ── investment table wrapper ── */
  function InvestmentTable({ items }: { items: PortfolioInvestment[] }) {
    if (!items.length) return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
        <p className="text-sm text-slate-500">{t("no_entries_here_yet")}</p>
        <button
          type="button"
          onClick={() => openAdd({ status: tab })}
          className="mt-3 rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          + Add {tab === "invested" ? "investment" : tab === "committed" ? "commitment" : "company to track"}
        </button>
      </div>
    );
    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {["Company", "Sector", "Stage", "Date", "Amount", "Entry val.", "Current val.", "ROI", ""].map((h) => (
                <th
                  key={h}
                  className={`px-4 py-2.5 text-[9.5px] font-semibold uppercase tracking-wide text-slate-400 ${
                    h && h !== "Company" ? "text-right" : "text-left"
                  }`}
                >{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((inv) => <InvestmentRow key={inv.id} inv={inv} />)}
          </tbody>
        </table>
        <div className="flex justify-between border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-400">
          <span>{items.length} {items.length === 1 ? "entry" : "entries"}</span>
          {items.some((i) => i.source === "deal_room") && (
            <span>{items.filter((i) => i.source === "deal_room").length} linked to deal room</span>
          )}
        </div>
      </div>
    );
  }

  /* ── unlinked pledge card ── */
  function PledgeCard({ pledge }: { pledge: PledgeRecord }) {
    return (
      <div className="flex items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50/50">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEEDFE] text-[11px] font-bold text-[#2E78F5]">
          {initials(pledge.company_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{pledge.company_name}</p>
          <p className="text-[11px] text-slate-400">
            Pledge:{" "}
            <span className="font-semibold text-slate-700">
              {fmtCurrency(pledge.pledge_amount, pledge.pledge_currency ?? "USD")}
            </span>
            {" · "}{formatDate(pledge.created_at)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={converting === pledge.id}
            onClick={() => void convertPledge(pledge, "committed")}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {converting === pledge.id ? "…" : "Add to Portfolio"}
          </button>
          <button
            type="button"
            onClick={() =>
              openAdd({
                company_id:      pledge.company_id ?? "",
                company_name:    pledge.company_name,
                company_slug:    pledge.company_slug ?? "",
                interest_id:     pledge.id,
                amount_invested: String(pledge.pledge_amount ?? ""),
                status:          "committed",
                invested_at:     new Date().toISOString().slice(0, 10),
              })
            }
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            Customize
          </button>
        </div>
      </div>
    );
  }

  /* computed lists */
  const visibleInvested  = applySearch(investedList);
  const visibleCommitted = applySearch(committedList);
  const visibleTracking  = applySearch(trackingList);

  /* ── render ── */
  return (
    <div>
      {/* ── Stats ── */}
      <div className="mb-5 flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-slate-200 pb-5">
        {[
          { label: "Total deployed",  value: fmt(totalDeployed),  color: "" },
          { label: "Committed",       value: fmt(totalCommitted), color: "text-blue-600" },
          { label: "Portfolio value", value: fmt(totalValue),     color: "" },
          {
            label: "ROI",
            value: totalDeployed > 0
              ? `${totalRoiPct >= 0 ? "+" : ""}${totalRoiPct.toFixed(1)}%`
              : "—",
            color: totalDeployed > 0
              ? totalRoiPct >= 0 ? "text-emerald-600" : "text-red-600"
              : "",
          },
          { label: "Deals",    value: String(investments.length),  color: "" },
          { label: "Tracking", value: String(trackingList.length), color: "text-amber-600" },
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
        {/* Status tabs */}
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          {(["invested", "committed", "tracking"] as PortfolioStatus[]).map((t) => {
            const meta = STATUS_META[t];
            const count =
              t === "committed"
                ? committedList.length + unlinkedPledges.length
                : t === "invested"
                ? investedList.length
                : trackingList.length;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === t
                    ? "border border-slate-200 bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
                <span
                  className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                    tab === t ? "bg-slate-100 text-slate-600" : "bg-slate-200 text-slate-500"
                  }`}
                >{count}</span>
              </button>
            );
          })}
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search_portfolio")}
          className="min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />

        <button
          type="button"
          onClick={() => exportCSV(investments)}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Export CSV
        </button>

        <button
          type="button"
          onClick={() => openAdd({ status: tab })}
          className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          + Add {tab === "invested" ? "investment" : tab === "committed" ? "commitment" : "to track"}
        </button>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">{t("loading_portfolio")}</p>
        </div>
      ) : (
        <>
          {/* Invested */}
          {tab === "invested" && InvestmentTable({ items: visibleInvested })}

          {/* Committed */}
          {tab === "committed" && (
            <div className="flex flex-col gap-4">
              {unlinkedPledges.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Platform pledges · {unlinkedPledges.length}
                  </p>
                  <div className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
                    {unlinkedPledges.map((p) => <PledgeCard key={p.id} pledge={p} />)}
                  </div>
                </div>
              )}
              {visibleCommitted.length > 0 && (
                <div>
                  {unlinkedPledges.length > 0 && (
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Portfolio commitments · {visibleCommitted.length}
                    </p>
                  )}
                  {InvestmentTable({ items: visibleCommitted })}
                </div>
              )}
              {!unlinkedPledges.length && !committedList.length && (
                <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
                  <p className="text-sm text-slate-500">
                    No commitments yet. Pledges you make on the platform will appear here automatically.
                  </p>
                  <button
                    type="button"
                    onClick={() => openAdd({ status: "committed" })}
                    className="mt-3 rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                  >
                    + Add commitment manually
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tracking */}
          {tab === "tracking" && InvestmentTable({ items: visibleTracking })}
        </>
      )}

      {/* ── Add / Edit modal ── */}
      {showForm && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0c2340]/50 p-5"
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div className="max-h-[90vh] w-full max-w-[540px] overflow-y-auto rounded-2xl bg-white p-7 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {editId ? "Edit entry" : "Add to portfolio"}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-lg leading-none text-slate-400 hover:text-slate-600"
              >✕</button>
            </div>

            {formError && (
              <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-3.5 gap-y-3">
              {/* Status toggle */}
              <div className="col-span-2">
                <label className={labelCls}>{t("status")}</label>
                <div className="flex gap-2">
                  {(["invested", "committed", "tracking"] as PortfolioStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, status: s }))}
                      className={`flex-1 rounded-lg border py-2 text-[12px] font-medium transition-colors ${
                        form.status === s
                          ? s === "invested"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : s === "committed"
                            ? "border-blue-300 bg-blue-50 text-blue-700"
                            : "border-amber-300 bg-amber-50 text-amber-700"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >{STATUS_META[s].label}</button>
                  ))}
                </div>
              </div>

              {/* Company */}
              <div className="col-span-2">
                <label className={labelCls}>{t("company_name_2")}</label>
                <input
                  value={form.company_name}
                  onChange={field("company_name")}
                  placeholder={t("e_g_nexaflow_ai")}
                  className={inputCls}
                />
                {form.company_slug && (
                  <p className="mt-1 text-[11px] text-[#2E78F5]">
                    Platform company — linked to iCapOS profile
                  </p>
                )}
              </div>

              <div>
                <label className={labelCls}>{t("sector")}</label>
                <input value={form.sector} onChange={field("sector")} placeholder={t("e_g_fintech")} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("stage")}</label>
                <select value={form.stage} onChange={field("stage")} className={inputCls}>
                  <option value="">Select stage</option>
                  {STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>
                  {form.status === "committed"
                    ? "Pledge amount ($)"
                    : form.status === "tracking"
                    ? "Target amount ($, optional)"
                    : "Amount invested ($) *"}
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.amount_invested}
                  onChange={field("amount_invested")}
                  placeholder={form.status === "tracking" ? "Optional" : "10000"}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  {form.status === "committed" ? "Target / expected date" : "Date *"}
                </label>
                <input type="date" value={form.invested_at} onChange={field("invested_at")} className={inputCls} />
              </div>

              {form.status === "invested" && (
                <>
                  <div>
                    <label className={labelCls}>{t("entry_valuation")}</label>
                    <input
                      type="number" min="0" value={form.entry_valuation}
                      onChange={field("entry_valuation")} placeholder="8000000" className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>{t("current_valuation")}</label>
                    <input
                      type="number" min="0" value={form.current_valuation}
                      onChange={field("current_valuation")} placeholder="19000000" className={inputCls}
                    />
                  </div>
                </>
              )}

              {!editId && dealRooms.length > 0 && (
                <div className="col-span-2">
                  <label className={labelCls}>{t("link_to_deal_room_optional")}</label>
                  <select value={form.deal_room_id} onChange={field("deal_room_id")} className={inputCls}>
                    <option value="">No deal room</option>
                    {dealRooms.map((dr) => <option key={dr.id} value={dr.id}>{dr.title}</option>)}
                  </select>
                </div>
              )}

              <div className="col-span-2">
                <label className={labelCls}>{t("notes")}</label>
                <textarea
                  value={form.notes}
                  onChange={field("notes")}
                  placeholder={t("any_notes_about_this_deal")}
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
              >{t("cancel")}</button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : editId ? "Save changes" : "Add to portfolio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
