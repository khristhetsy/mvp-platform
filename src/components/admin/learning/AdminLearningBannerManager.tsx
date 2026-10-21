"use client";

import { useState } from "react";
import { formatApiError } from "@/lib/api/errors";

export type BannerProgram = {
  id: string;
  title: string;
  description: string;
  readiness_focus: string | null;
  is_published: boolean | null;
  order_index: number | null;
  promo_headline: string | null;
  promo_blurb: string | null;
  promo_cta_label: string | null;
  show_in_banner: boolean | null;
};

type Draft = { promo_headline: string; promo_blurb: string; promo_cta_label: string; show_in_banner: boolean };

const THEMES = ["#0A1A40", "#185FA5", "#2D2A6E"];

function toDraft(p: BannerProgram): Draft {
  return {
    promo_headline: p.promo_headline ?? "",
    promo_blurb: p.promo_blurb ?? "",
    promo_cta_label: p.promo_cta_label ?? "",
    show_in_banner: p.show_in_banner !== false,
  };
}

async function patch(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/learning/banner", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw json;
  return json;
}

export function AdminLearningBannerManager({ initial }: Readonly<{ initial: BannerProgram[] }>) {
  const [rows, setRows] = useState<BannerProgram[]>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const [draft, setDraft] = useState<Draft | null>(initial[0] ? toDraft(initial[0]) : null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  function select(row: BannerProgram) {
    setSelectedId(row.id);
    setDraft(toDraft(row));
    setMessage(null);
  }

  async function save() {
    if (!selected || !draft) return;
    setBusy(true);
    setMessage(null);
    try {
      await patch({
        id: selected.id,
        promo_headline: draft.promo_headline,
        promo_blurb: draft.promo_blurb,
        promo_cta_label: draft.promo_cta_label,
        show_in_banner: draft.show_in_banner,
      });
      setRows((current) =>
        current.map((r) =>
          r.id === selected.id
            ? {
                ...r,
                promo_headline: draft.promo_headline.trim() || null,
                promo_blurb: draft.promo_blurb.trim() || null,
                promo_cta_label: draft.promo_cta_label.trim() || null,
                show_in_banner: draft.show_in_banner,
              }
            : r,
        ),
      );
      setMessage({ kind: "ok", text: "Saved" });
    } catch (e) {
      setMessage({ kind: "error", text: formatApiError(e, "Couldn't save. Try again.") });
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    const renumbered = next.map((r, i) => ({ ...r, order_index: i }));
    const changed = renumbered.filter((r) => r.order_index !== rows.find((x) => x.id === r.id)?.order_index);
    setBusy(true);
    setMessage(null);
    try {
      for (const r of changed) {
        await patch({ id: r.id, order_index: r.order_index });
      }
      setRows(renumbered);
      setMessage({ kind: "ok", text: "Order saved" });
    } catch (e) {
      setMessage({ kind: "error", text: formatApiError(e, "Couldn't save the order. Reload and try again.") });
    } finally {
      setBusy(false);
    }
  }

  // The preview follows the same fallbacks the founder banner uses.
  const previewIndex = Math.max(0, rows.findIndex((r) => r.id === selectedId));
  const previewHeadline = draft?.promo_headline.trim() || selected?.title || "";
  const previewBlurb = (draft?.promo_blurb.trim() || selected?.description || "").slice(0, 150);
  const previewCta = draft?.promo_cta_label.trim() || "Get started";

  if (rows.length === 0) {
    return <p className="text-sm text-slate-600">No courses yet. Create a course first, then come back to promote it.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Course</th>
              <th className="px-3 py-2">Stage focus</th>
              <th className="px-3 py-2">In banner</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr key={row.id} className={row.id === selectedId ? "bg-indigo-50" : undefined}>
                <td className="whitespace-nowrap px-3 py-2">
                  <button type="button" disabled={busy || i === 0} onClick={() => void move(i, -1)} aria-label={`Move ${row.title} up`} className="mr-1 rounded border border-slate-200 px-1.5 text-xs disabled:opacity-40">
                    ↑
                  </button>
                  <button type="button" disabled={busy || i === rows.length - 1} onClick={() => void move(i, 1)} aria-label={`Move ${row.title} down`} className="rounded border border-slate-200 px-1.5 text-xs disabled:opacity-40">
                    ↓
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => select(row)} className="font-medium text-indigo-700 hover:underline">
                    {row.title}
                  </button>
                </td>
                <td className="px-3 py-2 text-slate-700">{row.readiness_focus ?? "General"}</td>
                <td className="px-3 py-2 text-slate-700">{row.show_in_banner !== false ? "Yes" : "No"}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${row.is_published ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                    {row.is_published ? "Published" : "Draft"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="-mt-3 text-xs text-slate-500">Only published courses reach founders. Drafts never appear in the banner.</p>

      {selected && draft ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Banner copy: {selected.title}</p>
            <label className="block text-sm">
              <span className="text-slate-600">Banner headline</span>
              <input maxLength={80} placeholder={selected.title} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={draft.promo_headline} onChange={(e) => setDraft({ ...draft, promo_headline: e.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Banner text</span>
              <textarea maxLength={200} rows={3} placeholder="Leave empty to use the course description" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={draft.promo_blurb} onChange={(e) => setDraft({ ...draft, promo_blurb: e.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Button label</span>
              <input maxLength={30} placeholder="Get started" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={draft.promo_cta_label} onChange={(e) => setDraft({ ...draft, promo_cta_label: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={draft.show_in_banner} onChange={(e) => setDraft({ ...draft, show_in_banner: e.target.checked })} />
              Show in banner
            </label>
            <p className="text-xs text-slate-500">The banner image is the course banner image. Change it in the course editor.</p>
            {message ? (
              <div className={`rounded-lg border px-3 py-2 text-sm ${message.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>{message.text}</div>
            ) : null}
            <button type="button" onClick={() => void save()} disabled={busy} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {busy ? "Saving…" : "Save banner copy"}
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <p className="mb-2 text-sm font-semibold text-slate-900">Banner preview</p>
            <div className="rounded-xl p-4 text-white" style={{ background: THEMES[(previewIndex + 1) % THEMES.length] }}>
              <p className="text-[11px] font-semibold tracking-[0.08em] text-[#A9C2FF]">COURSE</p>
              <p className="mt-1 text-lg font-semibold leading-tight">{previewHeadline}</p>
              <p className="mt-1 text-sm text-[#D3DBEA]">{previewBlurb}</p>
              <span className="mt-3 inline-block rounded-lg bg-[#FFD24A] px-4 py-2 text-sm font-semibold text-[#2A1F00]">{previewCta}</span>
            </div>
            {!draft.show_in_banner ? <p className="mt-2 text-xs text-amber-700">This course is hidden from the banner.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
