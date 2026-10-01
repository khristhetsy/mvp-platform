"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  DatabaseZap,
  Download,
  Globe,
  Landmark,
  Mail,
  Phone,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { AI_FEATURE_META, CATEGORY_LABELS, type AiBudgetCategory } from "@/lib/ai-budget/config";

type Tool = { feature: string; label: string; calls: number; costUsd: number };
type Category = { category: AiBudgetCategory; budgetUsd: number; spentUsd: number; calls: number; tools: Tool[] };

const ICONS: Record<AiBudgetCategory, LucideIcon> = {
  founder: Rocket,
  investor: Landmark,
  public: Globe,
  internal: Briefcase,
  scheduled: Clock,
  enrichment: DatabaseZap,
  voice: Phone,
};

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (spent: number, budget: number) => (budget > 0 ? (spent / budget) * 100 : spent > 0 ? 100 : 0);

function nextResetLabel(): string {
  const d = new Date();
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return next.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Internal hub tools roll up into their hub group; other categories list tools as is. */
function rows(c: Category): Tool[] {
  if (c.category !== "internal") return c.tools;
  const groups = new Map<string, Tool>();
  for (const t of c.tools) {
    const g = AI_FEATURE_META[t.feature]?.group ?? "Admin tools";
    const cur = groups.get(g) ?? { feature: g, label: g, calls: 0, costUsd: 0 };
    cur.calls += t.calls;
    cur.costUsd += t.costUsd;
    groups.set(g, cur);
  }
  return [...groups.values()].sort((a, b) => b.costUsd - a.costUsd);
}

export function AiBudgetControls() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [alertEmail, setAlertEmail] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  function apply(j: { categories?: Category[]; alertEmail?: string | null; error?: string }, ok: boolean) {
    if (!ok) {
      setLoadError(j.error ?? "Could not load the AI budget.");
      return;
    }
    setLoadError(null);
    setCategories(j.categories ?? []);
    setAlertEmail(j.alertEmail ?? null);
    setDrafts(Object.fromEntries((j.categories ?? []).map((c) => [c.category, String(c.budgetUsd)])));
  }

  async function fetchStatus() {
    const res = await fetch("/api/admin/ai-budget");
    return { ok: res.ok, j: await res.json().catch(() => ({})) };
  }

  async function load() {
    const { ok, j } = await fetchStatus();
    apply(j, ok);
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      const { ok, j } = await fetchStatus();
      if (active) apply(j, ok);
    })();
    return () => { active = false; };
  }, []);

  const totals = useMemo(() => {
    const budget = categories.reduce((s, c) => s + c.budgetUsd, 0);
    const spent = categories.reduce((s, c) => s + c.spentUsd, 0);
    const calls = categories.reduce((s, c) => s + c.calls, 0);
    return { budget, spent, calls };
  }, [categories]);

  const draftTotal = categories.reduce((s, c) => s + (Number(drafts[c.category]) || 0), 0);

  async function save() {
    const budgets: Record<string, number> = {};
    for (const c of categories) {
      const v = Number(drafts[c.category]);
      if (!Number.isFinite(v) || v < 0 || drafts[c.category]?.trim() === "") {
        setMsg({ text: `Enter a dollar amount for ${CATEGORY_LABELS[c.category]}.`, ok: false });
        return;
      }
      budgets[c.category] = v;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/ai-budget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgets }),
      });
      const j = await res.json().catch(() => ({}));
      setMsg({ text: res.ok ? "Saved. Applies to the next AI call." : (j.error ?? "Could not save."), ok: res.ok });
      if (res.ok) await load();
    } catch {
      setMsg({ text: "Could not save.", ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
        <Coins className="h-5 w-5 text-[var(--gold,#B8860B)]" strokeWidth={1.75} aria-hidden /> AI budget
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Each category has a monthly dollar budget. When a category reaches its budget, AI calls billed to it stop until the
        1st of next month (UTC) or until you raise it. The total is the sum of the categories.
      </p>

      {loadError ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{loadError}</div>
      ) : categories.length === 0 ? null : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-500">Total budget</div>
              <div className="text-2xl font-semibold text-slate-950">{usd(totals.budget)}</div>
              <div className="text-xs text-slate-400">Sum of categories</div>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-500">Actual spend</div>
              <div className="text-2xl font-semibold text-slate-950">{usd(totals.spent)}</div>
              <div className="text-xs text-slate-400">
                {pct(totals.spent, totals.budget).toFixed(1)}% used · {totals.calls.toLocaleString("en-US")} calls · resets {nextResetLabel()}
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-[11px] uppercase tracking-wide text-slate-400">
              <span>Category · open for tools</span>
              <span>Monthly budget</span>
            </div>
            <div className="divide-y divide-slate-100">
              {categories.map((c) => {
                const Icon = ICONS[c.category];
                const p = pct(c.spentUsd, c.budgetUsd);
                const stopped = p >= 100;
                const near = !stopped && p >= 80;
                const isOpen = open === c.category;
                const toolRows = rows(c);
                return (
                  <div key={c.category} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : c.category)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium text-slate-900"
                        aria-expanded={isOpen}
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden /> : <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />}
                        <Icon className="h-4 w-4 text-slate-500" strokeWidth={1.75} aria-hidden />
                        <span className="truncate">{CATEGORY_LABELS[c.category]}</span>
                      </button>
                      <label className="flex items-center gap-1 text-sm text-slate-500">
                        $
                        <input
                          type="number"
                          min={0}
                          step="1"
                          inputMode="decimal"
                          aria-label={`${CATEGORY_LABELS[c.category]} monthly budget`}
                          value={drafts[c.category] ?? ""}
                          onChange={(e) => {
                            setMsg(null);
                            setDrafts((d) => ({ ...d, [c.category]: e.target.value }));
                          }}
                          className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </label>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${stopped ? "bg-red-500" : near ? "bg-amber-500" : "bg-indigo-600"}`}
                        style={{ width: `${Math.min(100, p)}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-xs">
                      <span className="text-slate-600">{usd(c.spentUsd)} actual</span>
                      <span className={stopped ? "text-red-700" : near ? "text-amber-700" : "text-slate-500"}>
                        {p.toFixed(1)}% used{stopped ? " · stopped" : near ? " · near budget" : ""}
                      </span>
                    </div>
                    {isOpen && (
                      <div className="mt-2 space-y-1 pl-6 text-xs text-slate-600">
                        {toolRows.length === 0 ? (
                          <div className="text-slate-400">No spend this month.</div>
                        ) : (
                          toolRows.map((t) => (
                            <div key={t.feature} className="grid grid-cols-[1fr_auto_auto] gap-3">
                              <span className="truncate">{t.label}</span>
                              <span className="text-slate-400">{t.calls.toLocaleString("en-US")} {c.category === "enrichment" && t.feature === "web_search" ? "searches" : "calls"}</span>
                              <span className="w-16 text-right text-slate-700">{usd(t.costUsd)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <span className="text-xs text-slate-500">Total of category budgets: {usd(draftTotal)}</span>
              <div className="flex items-center gap-3">
                {msg && <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span>}
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save budgets"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-1 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" aria-hidden />
              Email at 80% and 100% of any category, and of the total{alertEmail ? `, to ${alertEmail}` : ""}
            </div>
            <a href="/api/admin/ai-budget?export=csv" className="flex items-center gap-1.5 text-indigo-700 hover:text-indigo-600">
              <Download className="h-3.5 w-3.5" aria-hidden />
              Export this month as CSV, one row per call
            </a>
          </div>
        </>
      )}
    </section>
  );
}
