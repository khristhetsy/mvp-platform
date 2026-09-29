"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

/**
 * Deploy → Step 1 · Public Profile, laid out like the business plan and pitch
 * deck builders: a section menu with the editor on the left, the live investor
 * one-pager on the right. Saves go through the same PATCH /api/companies/:id the
 * full profile form uses, so this page, the public page and investor matching
 * stay in sync. Fields with managed option lists (industry, stage, amount of
 * capital) are edited on the full profile page, linked from here.
 */

type FieldKey =
  | "company_name"
  | "website"
  | "country"
  | "state"
  | "business_description"
  | "key_highlights"
  | "team_summary"
  | "management_team"
  | "use_of_funds"
  | "founder_goals";

type FieldDef = { key: FieldKey; label: string; multiline?: boolean; placeholder?: string; min?: number; counter?: boolean };

type Section = { id: string; label: string; hint: string; fields: FieldDef[]; locked?: boolean };

const SECTIONS: Section[] = [
  {
    id: "header",
    label: "Company header",
    hint: "The name, website and location investors see first.",
    fields: [
      { key: "company_name", label: "Company name", min: 2 },
      { key: "website", label: "Website", placeholder: "https://example.com" },
      { key: "country", label: "Country", placeholder: "United States", min: 2 },
      { key: "state", label: "State or province", placeholder: "California" },
    ],
  },
  {
    id: "overview",
    label: "Overview",
    hint: "Lead with the problem you solve. Three or four tight sentences.",
    fields: [{ key: "business_description", label: "Description", multiline: true, min: 20, counter: true }],
  },
  {
    id: "highlights",
    label: "Key highlights",
    hint: "One per line. These become the bullets on your one-pager.",
    fields: [{ key: "key_highlights", label: "Five key highlights", multiline: true }],
  },
  {
    id: "team",
    label: "Team",
    hint: "Who is building this and why they will win.",
    fields: [
      { key: "team_summary", label: "Team summary", multiline: true },
      { key: "management_team", label: "Management team", multiline: true, placeholder: "2 co-founders, 3 full-time" },
    ],
  },
  {
    id: "funds",
    label: "Use of funds",
    hint: "Show the percentage split and the milestone it funds.",
    fields: [{ key: "use_of_funds", label: "Use of funds", multiline: true, min: 10 }],
  },
  {
    id: "fit",
    label: "Investor fit notes",
    hint: "What you want beyond capital: network, board experience, synergies.",
    fields: [{ key: "founder_goals", label: "Investor-fit notes", multiline: true, min: 10 }],
  },
  {
    id: "disclaimer",
    label: "Disclaimer",
    hint: "Added by iCapOS to every profile. It can't be edited.",
    fields: [],
    locked: true,
  },
];

type Values = Record<FieldKey, string>;

export function PublicProfileEditor({
  companyId,
  initial,
}: Readonly<{ companyId: string; initial: Partial<Record<FieldKey, string | null>> }>) {
  const start = useMemo(() => {
    const v = {} as Values;
    for (const s of SECTIONS) for (const f of s.fields) v[f.key] = initial[f.key] ?? "";
    return v;
  }, [initial]);

  const [values, setValues] = useState<Values>(start);
  const [saved, setSaved] = useState<Values>(start);
  const [active, setActive] = useState<string>("overview");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];
  const sectionDone = (s: Section) => s.locked || s.fields.every((f) => values[f.key].trim().length > 0);
  const doneCount = SECTIONS.filter(sectionDone).length;
  const changedKeys = section.fields.filter((f) => values[f.key].trim() !== saved[f.key].trim()).map((f) => f.key);

  async function saveSection() {
    if (changedKeys.length === 0) return;
    for (const f of section.fields) {
      const len = values[f.key].trim().length;
      if (f.min && changedKeys.includes(f.key) && len < f.min) {
        setMessage({ tone: "error", text: `${f.label} needs at least ${f.min} characters.` });
        return;
      }
    }
    setSaving(true);
    setMessage(null);
    const payload: Record<string, string> = {};
    for (const k of changedKeys) payload[k] = values[k].trim();
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        details?: { fieldErrors?: Record<string, string[]> };
      } | null;
      if (!res.ok) {
        const fieldError = body?.details?.fieldErrors ? Object.values(body.details.fieldErrors).flat()[0] : null;
        setMessage({ tone: "error", text: fieldError ?? body?.error ?? "Couldn't save. Try again." });
        return;
      }
      setSaved((p) => ({ ...p, ...payload }));
      setPreviewKey((k) => k + 1);
      setMessage({ tone: "ok", text: "Saved. The preview is updated." });
    } catch {
      setMessage({ tone: "error", text: "Network error. Try again." });
    } finally {
      setSaving(false);
    }
  }

  function pick(id: string) {
    setActive(id);
    setMessage(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* ---------- LEFT · section menu + editor ---------- */}
      <div className="min-w-0 space-y-3">
        <div className="rounded-xl border border-slate-200 bg-white p-2">
          <p className="px-2 pb-1.5 pt-1 text-[11px] font-medium text-slate-400">
            Sections · {doneCount} of {SECTIONS.length} done
          </p>
          <ul className="space-y-0.5">
            {SECTIONS.map((s) => {
              const on = s.id === active;
              const done = sectionDone(s);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => pick(s.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
                      on ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>{s.label}</span>
                    {s.locked ? (
                      <i className="ti ti-lock text-slate-400" aria-label="Locked" />
                    ) : done ? (
                      <i className="ti ti-circle-check text-emerald-500" aria-label="Done" />
                    ) : (
                      <i className="ti ti-alert-circle text-amber-500" aria-label="Needs work" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">{section.label}</p>
          <p className="mt-0.5 text-xs text-slate-500">{section.hint}</p>

          {section.locked ? (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
              Informational only. This profile is not an offer to sell or a solicitation to buy securities, and not
              investment advice.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {section.fields.map((f) => (
                <div key={f.key}>
                  <label htmlFor={`pp-${f.key}`} className="mb-1 block text-xs font-medium text-slate-600">
                    {f.label}
                  </label>
                  {f.multiline ? (
                    <textarea
                      id={`pp-${f.key}`}
                      value={values[f.key]}
                      onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      rows={f.key === "business_description" ? 8 : 6}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
                    />
                  ) : (
                    <input
                      id={`pp-${f.key}`}
                      value={values[f.key]}
                      onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
                    />
                  )}
                  {f.counter ? (
                    <p className="mt-1 text-[11px] text-slate-400">{values[f.key].length} characters</p>
                  ) : null}
                </div>
              ))}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void saveSection()}
                  disabled={saving || changedKeys.length === 0}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save section"}
                </button>
                {changedKeys.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setValues((p) => ({ ...p, ...Object.fromEntries(changedKeys.map((k) => [k, saved[k]])) }))}
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Discard
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {message ? (
            <p className={`mt-3 text-xs ${message.tone === "ok" ? "text-emerald-600" : "text-red-600"}`} role="status">
              {message.text}
            </p>
          ) : null}
        </div>

        <p className="px-1 text-[11px] leading-relaxed text-slate-400">
          Logo, industry, stage and amount of capital use managed lists.{" "}
          <Link href="/founder/settings" className="font-medium text-indigo-600 hover:text-indigo-700">
            Edit them in your full profile
          </Link>
          .
        </p>
      </div>

      {/* ---------- RIGHT · live preview ---------- */}
      <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white lg:sticky lg:top-16 lg:self-start">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
          <span className="text-xs font-medium text-slate-500">Live preview · exactly what investors see</span>
          <span className="text-[11px] text-slate-400">Updates when you save</span>
        </div>
        <iframe
          key={previewKey}
          src="/founder/preview?embed=1"
          title="Investor one-pager preview"
          className="h-[720px] w-full border-0"
        />
      </div>
    </div>
  );
}
