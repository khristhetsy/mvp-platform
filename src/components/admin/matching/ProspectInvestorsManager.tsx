"use client";

import { useState } from "react";
import type { ProspectInvestor } from "@/lib/matching/prospect-investors";

type Props = {
  initialProspects: ProspectInvestor[];
};

const EMPTY_FORM = {
  name: "",
  investor_type: "",
  source: "",
  preferred_sectors: "",
  preferred_stages: "",
  preferred_geographies: "",
  check_size_min: "",
  check_size_max: "",
  notes: "",
};

function formatCheckSize(min: number | null, max: number | null): string {
  const fmt = (n: number) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`
      : n >= 1_000
        ? `$${(n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K`
        : `$${n.toLocaleString()}`;
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  if (min != null) return `${fmt(min)}+`;
  if (max != null) return `up to ${fmt(max)}`;
  return "—";
}

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function ProspectInvestorsManager({ initialProspects }: Props) {
  const [prospects, setProspects] = useState<ProspectInvestor[]>(initialProspects);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setError(null);

    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/prospect-investors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          investor_type: form.investor_type,
          source: form.source,
          preferred_sectors: form.preferred_sectors,
          preferred_stages: form.preferred_stages,
          preferred_geographies: form.preferred_geographies,
          check_size_min: form.check_size_min,
          check_size_max: form.check_size_max,
          notes: form.notes,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Failed to add prospect.");
        return;
      }

      const created = (await res.json()) as ProspectInvestor;
      setProspects((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleImport() {
    if (importing) return;
    setImporting(true);
    setImportResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/prospect-investors/import-from-crm", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Import failed.");
        return;
      }
      const r = (await res.json()) as { total: number; imported: number; skipped: number };
      setImportResult(
        `Imported ${r.imported} new investor${r.imported === 1 ? "" : "s"} · ${r.skipped} already present (of ${r.total} contacts). Reload the Matching page to see them.`,
      );
      const listRes = await fetch("/api/admin/prospect-investors");
      if (listRes.ok) {
        const data = (await listRes.json()) as { prospects: ProspectInvestor[] };
        setProspects(data.prospects);
      }
    } catch {
      setError("Network error during import.");
    } finally {
      setImporting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100";
  const labelClass = "mb-1 block text-xs font-medium text-slate-600";

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-slate-200 bg-blue-50/50 px-4 py-3 text-sm leading-6 text-slate-700">
        <p>
          Fill in sectors, stages, check size and geography — these drive the match score. A prospect
          with no preferences scores near zero.
        </p>
        <p className="mt-1 text-slate-600">
          Saved prospects appear in the{" "}
          <span className="font-medium text-slate-800">Matching</span> page ranked alongside members,
          suffixed <span className="font-mono text-xs text-slate-800">· prospect</span>.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {importing ? "Importing…" : "Import from investor CRM"}
          </button>
          <span className="text-xs text-slate-500">
            Pulls investor CRM contacts in as prospects (best-effort sector/geography). Safe to re-run — duplicates are skipped.
          </span>
        </div>

        {importResult ? (
          <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">{importResult}</p>
        ) : null}
      </div>

      {/* Add prospect form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-slate-900">Add a prospect</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Comma-separate multiple sectors, stages, or geographies.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="name">
              Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="name"
              className={inputClass}
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Acme Ventures"
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="investor_type">
              Investor type
            </label>
            <input
              id="investor_type"
              className={inputClass}
              value={form.investor_type}
              onChange={(e) => update("investor_type", e.target.value)}
              placeholder="VC, Angel, Family office"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="source">
              Source
            </label>
            <input
              id="source"
              className={inputClass}
              value={form.source}
              onChange={(e) => update("source", e.target.value)}
              placeholder="Conference, referral, list"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="preferred_sectors">
              Preferred sectors
            </label>
            <input
              id="preferred_sectors"
              className={inputClass}
              value={form.preferred_sectors}
              onChange={(e) => update("preferred_sectors", e.target.value)}
              placeholder="Fintech, SaaS, Health"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="preferred_stages">
              Preferred stages
            </label>
            <input
              id="preferred_stages"
              className={inputClass}
              value={form.preferred_stages}
              onChange={(e) => update("preferred_stages", e.target.value)}
              placeholder="Seed, Series A"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="preferred_geographies">
              Preferred geographies
            </label>
            <input
              id="preferred_geographies"
              className={inputClass}
              value={form.preferred_geographies}
              onChange={(e) => update("preferred_geographies", e.target.value)}
              placeholder="US, Europe, LATAM"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="check_size_min">
              Check size min
            </label>
            <input
              id="check_size_min"
              type="number"
              min="0"
              className={inputClass}
              value={form.check_size_min}
              onChange={(e) => update("check_size_min", e.target.value)}
              placeholder="50000"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="check_size_max">
              Check size max
            </label>
            <input
              id="check_size_max"
              type="number"
              min="0"
              className={inputClass}
              value={form.check_size_max}
              onChange={(e) => update("check_size_max", e.target.value)}
              placeholder="500000"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={labelClass} htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              className={inputClass}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Context, thesis, relationship owner…"
            />
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Adding…" : "Add prospect"}
          </button>
        </div>
      </form>

      {/* Existing prospects */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Prospects{" "}
            <span className="ml-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
              {prospects.length}
            </span>
          </h2>
        </div>

        {prospects.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No prospects yet. Add one above to seed the matching engine.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Sectors</th>
                  <th className="px-6 py-3">Stages</th>
                  <th className="px-6 py-3">Geographies</th>
                  <th className="px-6 py-3">Check size</th>
                  <th className="px-6 py-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prospects.map((p) => (
                  <tr key={p.id} className="align-top hover:bg-slate-50/60">
                    <td className="px-6 py-4 font-medium text-slate-900">{p.name}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {p.investor_type ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <TagList items={p.preferred_sectors} />
                    </td>
                    <td className="px-6 py-4">
                      <TagList items={p.preferred_stages} />
                    </td>
                    <td className="px-6 py-4">
                      <TagList items={p.preferred_geographies} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                      {formatCheckSize(p.check_size_min, p.check_size_max)}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {p.source ?? <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
