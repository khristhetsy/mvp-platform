"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LOCKED_PAGES, PAGE_LABEL, type BrochurePage, type BrochureSize } from "@/lib/event-hub/brochure/types";

type PickerEvent = { id: string; title: string; slug: string; status: string; startsAt: string | null; coverUrl: string | null };
type Preflight = { warnings: { level: string; text: string }[]; excludePresenters: boolean };

export function BrochureWizard({ initialEventId }: { initialEventId?: string }) {
  const [step, setStep] = useState(1);
  const [events, setEvents] = useState<PickerEvent[]>([]);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [pages, setPages] = useState<BrochurePage[]>([]);
  const [size, setSize] = useState<BrochureSize>("letter");
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/events/email/events");
        const json = await res.json();
        if (res.ok) setEvents(json.events as PickerEvent[]);
      } catch { /* ignore */ }
    })();
  }, []);

  const createEdition = useCallback(async (eventId: string) => {
    setError(null);
    try {
      const res = await fetch("/api/admin/events/brochure", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't create the edition.");
      setEditionId(json.edition.id);
      setPages(json.edition.pageConfig);
      setSize(json.edition.size);
      setTitle(json.edition.title);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the edition.");
    }
  }, []);

  useEffect(() => {
    if (!initialEventId) return;
    const t = setTimeout(() => void createEdition(initialEventId), 0);
    return () => clearTimeout(t);
  }, [initialEventId, createEdition]);

  const renderPreview = useCallback(async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/brochure/${id}/preview`, { method: "POST" });
      const json = await res.json();
      if (res.ok) { setHtml(json.html as string); setPreflight(json.preflight as Preflight); }
    } finally { setBusy(false); }
  }, []);

  // persist page config + re-render (debounced)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback((next: { pages?: BrochurePage[]; size?: BrochureSize }) => {
    if (!editionId) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      await fetch(`/api/admin/events/brochure/${editionId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageConfig: next.pages ?? pages, size: next.size ?? size }),
      });
      await renderPreview(editionId);
    }, 250);
  }, [editionId, pages, size, renderPreview]);

  useEffect(() => {
    if (step !== 2 || !editionId) return;
    const t = setTimeout(() => void renderPreview(editionId), 0);
    return () => clearTimeout(t);
  }, [step, editionId, renderPreview]);

  function toggleInclude(i: number) {
    const p = pages[i];
    if (LOCKED_PAGES.includes(p.type)) return;
    const next = pages.map((pg, idx) => (idx === i ? { ...pg, included: !pg.included } : pg));
    setPages(next); persist({ pages: next });
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 2 || j >= pages.length) return; // keep cover(0)+disclaimers(1) pinned
    if (LOCKED_PAGES.includes(pages[i].type)) return;
    const next = [...pages];
    [next[i], next[j]] = [next[j], next[i]];
    setPages(next); persist({ pages: next });
  }
  function changeSize(s: BrochureSize) { setSize(s); persist({ size: s }); }

  async function generate() {
    if (!editionId) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/events/brochure/${editionId}/generate`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't generate.");
      setGenerated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate.");
    } finally { setBusy(false); }
  }

  return (
    <div>
      {error && <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {step === 1 && (
        <div>
          <p className="mb-3 text-sm text-[var(--text-muted)]">Pick a published or live event — the booklet builds itself from the event record.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {events.map((e) => (
              <button key={e.id} type="button" onClick={() => createEdition(e.id)} className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-white p-3 text-left hover:border-[var(--blue)]">
                <span className="h-12 w-16 flex-none overflow-hidden rounded-md bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {e.coverUrl ? <img src={e.coverUrl} alt="" className="h-full w-full object-cover" /> : null}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-[var(--navy)]">{e.title}</span>
                  <span className="block text-xs text-[var(--text-muted)]">{e.status} · {e.startsAt ? new Date(e.startsAt).toLocaleDateString() : "date TBA"}</span>
                </span>
              </button>
            ))}
            {events.length === 0 && <p className="text-sm text-[var(--text-muted)]">No published or live events yet.</p>}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <div className="space-y-4">
            <div className="text-sm font-semibold text-[var(--navy)]">{title}</div>

            {/* preflight */}
            {preflight && preflight.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-bold text-amber-800">Before you generate</p>
                <ul className="mt-1 space-y-1 text-xs text-amber-800">
                  {preflight.warnings.map((w, i) => <li key={i}>• {w.text}</li>)}
                </ul>
              </div>
            )}

            {/* size */}
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Size</p>
              <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border-subtle)] text-xs">
                {(["letter", "a4", "square"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => changeSize(s)} className={`px-3 py-1 font-semibold uppercase ${size === s ? "bg-[var(--blue)] text-white" : "bg-white text-[var(--text-muted)]"}`}>{s}</button>
                ))}
              </div>
            </div>

            {/* page list */}
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Pages</p>
              <ul className="space-y-1">
                {pages.map((p, i) => {
                  const locked = LOCKED_PAGES.includes(p.type);
                  return (
                    <li key={p.key} className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-2 text-sm">
                      <input type="checkbox" checked={p.included} disabled={locked} onChange={() => toggleInclude(i)} />
                      <span className={`flex-1 ${p.included ? "text-[var(--navy)]" : "text-[var(--text-muted)] line-through"}`}>{PAGE_LABEL[p.type]}</span>
                      {locked ? <span className="text-[10px] font-semibold text-[var(--text-muted)]">🔒 required</span> : (
                        <span className="flex gap-1">
                          <button type="button" onClick={() => move(i, -1)} disabled={i <= 2} className="text-xs text-[var(--text-muted)] disabled:opacity-30">↑</button>
                          <button type="button" onClick={() => move(i, 1)} disabled={i >= pages.length - 1} className="text-xs text-[var(--text-muted)] disabled:opacity-30">↓</button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {generated ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <p className="font-semibold">Edition saved.</p>
                <p className="mt-1">Snapshot frozen. PDF export &amp; “Send booklet” land in the next pass.</p>
                <Link href="/admin/events/brochure" className="mt-2 inline-block font-semibold underline">Back to editions →</Link>
              </div>
            ) : (
              <button type="button" onClick={generate} disabled={busy} className="cap-btn-primary w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
                {busy ? "Working…" : "Save edition (freeze snapshot)"}
              </button>
            )}
            <p className="text-[11px] text-[var(--text-muted)]">Disclaimers &amp; footer are locked into every edition. Edit event data at the source, not here.</p>
          </div>

          {/* preview */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Booklet preview {busy && <span className="font-normal">· rendering…</span>}</p>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-slate-200 p-3">
              <iframe title="Booklet preview" srcDoc={html} style={{ width: "100%", height: 720, border: "none", background: "#dfe3ea", borderRadius: 8 }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
