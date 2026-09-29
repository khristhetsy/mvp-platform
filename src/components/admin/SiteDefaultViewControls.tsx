"use client";

import { useEffect, useState } from "react";

type View = "ai" | "browse";

const OPTIONS: { value: View; title: string; body: string }[] = [
  { value: "ai", title: "AI mode", body: "The home and events pages open in the full-screen AI conversation. Visitors can still pick “Browse the site instead”." },
  { value: "browse", title: "Browse the site", body: "Visitors land on the regular pages. AI mode stays one click away through the nav button and the launcher." },
];

/**
 * Admin switch for what public visitors see first on icapos.com. Writes the
 * `site_default_view` platform setting via /api/admin/site-default-view.
 */
export function SiteDefaultViewControls() {
  const [view, setView] = useState<View | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/site-default-view")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d?.view) setView(d.view); })
      .catch(() => { if (active) setMsg({ text: "Couldn't load the setting.", ok: false }); });
    return () => { active = false; };
  }, []);

  async function choose(next: View) {
    if (saving || next === view) return;
    const prev = view;
    setView(next);
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/site-default-view", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ view: next }),
      });
      if (!res.ok) throw new Error();
      setMsg({ text: "Saved. Applies on the next page load.", ok: true });
    } catch {
      setView(prev);
      setMsg({ text: "Couldn't save. Please try again.", ok: false });
    } finally {
      setSaving(false);
    }
  }

  if (view === null && !msg) return null;

  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-slate-900">Public site default view</h2>
        {msg ? <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span> : null}
      </div>
      <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">What visitors see first when they arrive on icapos.com.</p>
      <div role="radiogroup" aria-label="Public site default view" className="mt-3 grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((o) => {
          const selected = view === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={saving}
              onClick={() => void choose(o.value)}
              className={`rounded-lg border px-4 py-3 text-left transition disabled:opacity-60 ${selected ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-slate-200 hover:border-slate-300"}`}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <span className={`h-3.5 w-3.5 rounded-full border ${selected ? "border-indigo-600 bg-indigo-600 shadow-[inset_0_0_0_2px_white]" : "border-slate-400"}`} aria-hidden />
                {o.title}
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{o.body}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
