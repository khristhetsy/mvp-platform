"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LOCKED_PAGES, PAGE_LABEL, THEMES, THEME_LABEL, coverToFreeformBlocks, newFreeformPage, type BrochurePage, type BrochureSize, type BrochureTheme, type FreeformBlock } from "@/lib/event-hub/brochure/types";
import { BrochureCanvas } from "./BrochureCanvas";

type PickerEvent = { id: string; title: string; slug: string; status: string; startsAt: string | null; coverUrl: string | null };
type Preflight = { warnings: { level: string; text: string }[]; excludePresenters: boolean };

// Natural page size in CSS px (96dpi) — the preview scales to fit the panel width.
const PAGE_PX: Record<BrochureSize, [number, number]> = {
  letter: [816, 1056],
  a4: [794, 1123],
  square: [768, 768],
};

// Editable copy fields per standard page (dynamic lists still pull from the event).
type CopyField = { field: string; label: string; kind: "input" | "textarea"; placeholder: string };
const COPY_FIELDS: Record<string, CopyField[]> = {
  introduction: [
    { field: "heading", label: "Heading", kind: "input", placeholder: "Introduction" },
    { field: "body", label: "Body", kind: "textarea", placeholder: "Welcome copy — leave blank for the default." },
    { field: "audience", label: "Audience line", kind: "textarea", placeholder: "Who attends — leave blank for the default." },
  ],
  contents: [{ field: "heading", label: "Heading", kind: "input", placeholder: "Contents" }],
  agenda: [
    { field: "heading", label: "Heading", kind: "input", placeholder: "Agenda" },
    { field: "intro", label: "Intro", kind: "textarea", placeholder: "Optional blurb above the session list." },
  ],
  presenters: [
    { field: "heading", label: "Heading", kind: "input", placeholder: "Presenters" },
    { field: "intro", label: "Intro", kind: "textarea", placeholder: "Optional blurb above the speaker grid." },
  ],
  team: [
    { field: "heading", label: "Heading", kind: "input", placeholder: "MC & Event Team" },
    { field: "body", label: "Body", kind: "textarea", placeholder: "Leave blank for the default." },
  ],
  sponsors_contact: [
    { field: "heading", label: "Heading", kind: "input", placeholder: "Sponsors" },
    { field: "intro", label: "Intro", kind: "textarea", placeholder: "Optional blurb above the sponsor tiers." },
    { field: "contactHeading", label: "Contact heading", kind: "input", placeholder: "Contact" },
    { field: "contactBody", label: "Contact details", kind: "textarea", placeholder: "Leave blank to use the event organizer line." },
  ],
  disclaimers: [
    { field: "heading", label: "Heading", kind: "input", placeholder: "Disclaimers & Important Notices" },
    { field: "body", label: "Body (compliance — edit with care)", kind: "textarea", placeholder: "Leave blank to keep the standard compliance notices." },
  ],
};

export function BrochureWizard({ initialEventId, baseEditionId }: { initialEventId?: string; baseEditionId?: string }) {
  const [step, setStep] = useState(1);
  const [events, setEvents] = useState<PickerEvent[]>([]);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [pages, setPages] = useState<BrochurePage[]>([]);
  const [size, setSize] = useState<BrochureSize>("letter");
  const [theme, setTheme] = useState<BrochureTheme>("navy");
  const [title, setTitle] = useState("");
  const [overrides, setOverrides] = useState<Record<string, Record<string, string>>>({});
  const [source, setSource] = useState<{ title: string; tagline: string; dateLabel: string; badge: string } | null>(null);
  const [html, setHtml] = useState("");
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [generated, setGenerated] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [copyEditKey, setCopyEditKey] = useState<string | null>(null);
  const [pdfWarning, setPdfWarning] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [previewW, setPreviewW] = useState(0);
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const measure = () => setPreviewW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [step, editingKey, panelOpen]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/events/email/events");
        const json = await res.json();
        if (res.ok) setEvents(json.events as PickerEvent[]);
      } catch { /* ignore */ }
    })();
  }, []);

  const createEdition = useCallback(async (evId: string) => {
    setError(null);
    try {
      const res = await fetch("/api/admin/events/brochure", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: evId, baseEditionId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't create the edition.");
      setEditionId(json.edition.id);
      setEventId(json.edition.eventId ?? evId);
      setPages(json.edition.pageConfig);
      setSize(json.edition.size);
      setTheme(json.edition.theme ?? "navy");
      setTitle(json.edition.title);
      setOverrides(json.edition.overrides ?? {});
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the edition.");
    }
  }, [baseEditionId]);

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
      if (res.ok) { setHtml(json.html as string); setPreflight(json.preflight as Preflight); if (json.source) setSource(json.source as { title: string; tagline: string; dateLabel: string; badge: string }); }
    } finally { setBusy(false); }
  }, []);

  // persist page config + re-render (debounced)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback((next: { pages?: BrochurePage[]; size?: BrochureSize; overrides?: Record<string, Record<string, string>>; theme?: BrochureTheme }) => {
    if (!editionId) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      await fetch(`/api/admin/events/brochure/${editionId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageConfig: next.pages ?? pages, size: next.size ?? size, overrides: next.overrides ?? overrides, theme: next.theme ?? theme }),
      });
      await renderPreview(editionId);
    }, 250);
  }, [editionId, pages, size, overrides, theme, renderPreview]);

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
  function changeTheme(t: BrochureTheme) { setTheme(t); persist({ theme: t }); }

  /** Set (or clear, when value is empty) a per-page override; blank falls back to source (§6). */
  function setOverride(page: string, field: string, value: string) {
    const next: Record<string, Record<string, string>> = { ...overrides, [page]: { ...(overrides[page] ?? {}) } };
    if (value.trim() === "") { delete next[page][field]; if (Object.keys(next[page]).length === 0) delete next[page]; }
    else next[page][field] = value;
    setOverrides(next); persist({ overrides: next });
  }
  const ovVal = (page: string, field: string) => overrides[page]?.[field] ?? "";
  const titleDiffers = source != null && ovVal("cover", "title") !== "" && ovVal("cover", "title") !== source.title;

  function addCustomPage() {
    const key = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `custom-${Date.now()}`;
    const next: BrochurePage[] = [...pages, { key, type: "custom", included: true, custom: { layout: "text", heading: "New page", body: "" } }];
    setPages(next); persist({ pages: next });
  }
  function editCustom(i: number, patch: { heading?: string; body?: string }) {
    const next = pages.map((pg, idx) =>
      idx === i ? { ...pg, custom: { layout: pg.custom?.layout ?? "text", heading: pg.custom?.heading ?? "", body: pg.custom?.body ?? "", ...patch } } : pg,
    );
    setPages(next); persist({ pages: next });
  }
  function removePage(i: number) {
    if (pages[i].type !== "custom" && pages[i].type !== "freeform") return;
    const next = pages.filter((_, idx) => idx !== i);
    setPages(next); persist({ pages: next });
  }
  /** Duplicate a custom or design page, inserted right after it (fresh key + block ids). */
  function duplicatePage(i: number) {
    const src = pages[i];
    if (src.type !== "custom" && src.type !== "freeform") return;
    const key = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `dup-${Date.now()}`;
    const copy: BrochurePage = src.type === "freeform"
      ? { ...src, key, blocks: (src.blocks ?? []).map((b, bi) => ({ ...b, id: `${key}-${bi}` })) }
      : { ...src, key, custom: src.custom ? { ...src.custom, carried: false } : undefined };
    const next = [...pages.slice(0, i + 1), copy, ...pages.slice(i + 1)];
    setPages(next); persist({ pages: next });
  }
  function addDesignPage() {
    const key = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `design-${Date.now()}`;
    const next = [...pages, newFreeformPage(key)];
    setPages(next); persist({ pages: next }); setEditingKey(key);
  }
  function setBlocks(key: string, blocks: FreeformBlock[]) {
    const next = pages.map((pg) => (pg.key === key ? { ...pg, blocks } : pg));
    setPages(next); persist({ pages: next });
  }
  /** Convert the cover to an editable free-form layout seeded from its data. */
  function customizeCover() {
    if (!source) return;
    const t = THEMES[theme];
    const blocks = coverToFreeformBlocks(size, t.primary, t.coverBadge, {
      title: overrides.cover?.title || source.title,
      tagline: overrides.cover?.tagline || source.tagline,
      dateLabel: source.dateLabel,
      badge: source.badge,
    });
    const next = pages.map((pg) => (pg.type === "cover" ? { ...pg, blocks } : pg));
    setPages(next); persist({ pages: next });
    const cover = next.find((p) => p.type === "cover");
    if (cover) setEditingKey(cover.key);
  }
  function resetCover() {
    const next = pages.map((pg) => (pg.type === "cover" ? { ...pg, blocks: [] } : pg));
    setPages(next); persist({ pages: next });
    setEditingKey(null);
  }
  const editingPage = pages.find((p) => p.key === editingKey && (p.type === "freeform" || (p.type === "cover" && (p.blocks?.length ?? 0) > 0))) ?? null;
  /** Resolve a carried-over custom page (§7): keep the copy or reset it blank, then clear the flag. */
  function reviewCarried(i: number, action: "keep" | "reset") {
    const next = pages.map((pg, idx) => {
      if (idx !== i || pg.type !== "custom" || !pg.custom) return pg;
      const custom = action === "reset"
        ? { ...pg.custom, body: "", carried: false }
        : { ...pg.custom, carried: false };
      return { ...pg, custom };
    });
    setPages(next); persist({ pages: next });
  }
  const carried = pages.filter((p) => p.type === "custom" && p.custom?.carried);

  async function generate() {
    if (!editionId) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/events/brochure/${editionId}/generate`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't generate.");
      setPdfWarning(json.pdfWarning ?? null);
      setGenerated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate.");
    } finally { setBusy(false); }
  }

  async function togglePublish() {
    if (!editionId) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/events/brochure/${editionId}/publish`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ published: !published }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't update publish state.");
      setPublished(Boolean(json.edition.published));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update publish state.");
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
        <div className="flex items-start overflow-hidden">
          {!panelOpen && (
            <button type="button" onClick={() => setPanelOpen(true)} title="Show menu"
              className="mr-3 shrink-0 rounded-lg border border-[var(--border-subtle)] bg-white px-1.5 py-3 text-[11px] font-semibold text-[var(--blue)] hover:border-[var(--blue)]"
              style={{ writingMode: "vertical-rl" }}>
              Show menu ›
            </button>
          )}
          <div
            className="shrink-0 space-y-4"
            style={{ width: 340, marginLeft: panelOpen ? 0 : -364, marginRight: panelOpen ? 24 : 0, opacity: panelOpen ? 1 : 0, pointerEvents: panelOpen ? "auto" : "none", transition: "margin-left .35s ease, opacity .25s ease" }}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--navy)]">{title}</div>
              <button type="button" onClick={() => setPanelOpen(false)} className="text-xs font-semibold text-[var(--blue)] hover:underline">‹ Hide</button>
            </div>

            {/* preflight */}
            {preflight && preflight.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-bold text-amber-800">Before you generate</p>
                <ul className="mt-1 space-y-1 text-xs text-amber-800">
                  {preflight.warnings.map((w, i) => <li key={i}>• {w.text}</li>)}
                </ul>
              </div>
            )}

            {/* carried-over copy review (§7) */}
            {carried.length > 0 && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                <p className="text-xs font-bold text-indigo-800">Review carried-over copy</p>
                <p className="mt-0.5 text-[11px] text-indigo-700">Hand-written pages copied from the previous edition. Confirm each so no stale city or date reaches print.</p>
                <ul className="mt-2 space-y-2">
                  {carried.map((p) => {
                    const idx = pages.indexOf(p);
                    return (
                      <li key={p.key} className="rounded-md border border-indigo-200 bg-white px-2 py-1.5">
                        <p className="text-xs font-semibold text-[var(--navy)]">{p.custom?.heading || "Custom page"}</p>
                        {p.custom?.body && <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--text-muted)]">{p.custom.body}</p>}
                        <div className="mt-1 flex gap-3">
                          <button type="button" onClick={() => reviewCarried(idx, "keep")} className="text-[11px] font-semibold text-[var(--blue)] hover:underline">Keep</button>
                          <button type="button" onClick={() => reviewCarried(idx, "reset")} className="text-[11px] font-semibold text-rose-500 hover:underline">Reset to blank</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* theme preset */}
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Theme preset</p>
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.keys(THEMES) as BrochureTheme[]).map((tk) => (
                  <button key={tk} type="button" onClick={() => changeTheme(tk)} className={`rounded-lg border p-1.5 text-center ${theme === tk ? "border-[var(--blue)] ring-1 ring-[var(--blue)]" : "border-[var(--border-subtle)]"}`}>
                    <span className="block h-5 w-full rounded" style={{ background: THEMES[tk].primary }} />
                    <span className="mt-1 block text-[10px] text-[var(--text-muted)]">{THEME_LABEL[tk]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* size */}
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Size</p>
              <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border-subtle)] text-xs">
                {(["letter", "a4", "square"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => changeSize(s)} className={`px-3 py-1 font-semibold uppercase ${size === s ? "bg-[var(--blue)] text-white" : "bg-white text-[var(--text-muted)]"}`}>{s}</button>
                ))}
              </div>
            </div>

            {/* cover copy (other pages edit inline in the list below) */}
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Cover</p>
              <div className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-white p-3">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-[var(--navy)]">Cover title</label>
                    {titleDiffers && (
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-700">
                        differs from event
                        <button type="button" onClick={() => setOverride("cover", "title", "")} className="underline">revert</button>
                        {eventId && <a href={`/admin/events/${eventId}`} target="_blank" rel="noreferrer" className="underline">fix at source</a>}
                      </span>
                    )}
                  </div>
                  <input value={ovVal("cover", "title")} onChange={(e) => setOverride("cover", "title", e.target.value)} placeholder={source?.title ?? "Pulled from event"} className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs" />
                  <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">Pulled field — leave blank to use the event title.</p>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[var(--navy)]">Cover tagline</label>
                  <input value={ovVal("cover", "tagline")} onChange={(e) => setOverride("cover", "tagline", e.target.value)} placeholder={source?.tagline || "Optional tagline"} className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs" />
                </div>
              </div>
            </div>

            {/* page list */}
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Pages</p>
              <ul className="space-y-1">
                {pages.map((p, i) => {
                  const locked = LOCKED_PAGES.includes(p.type);
                  const isCustom = p.type === "custom";
                  const isFreeform = p.type === "freeform";
                  const label = isCustom ? (p.custom?.heading || "Custom page") : isFreeform ? "Design page" : PAGE_LABEL[p.type];
                  return (
                    <li key={p.key} className={`rounded-lg border bg-white px-3 py-2 text-sm ${editingKey === p.key ? "border-[var(--blue)]" : "border-[var(--border-subtle)]"}`}>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={p.included} disabled={locked} onChange={() => toggleInclude(i)} />
                        <span className={`flex-1 ${p.included ? "text-[var(--navy)]" : "text-[var(--text-muted)] line-through"}`}>{label}</span>
                        {locked ? (
                          <span className="flex items-center gap-2">
                            {p.type === "cover" && source && (
                              editingKey === p.key ? (
                                <button type="button" onClick={() => setEditingKey(null)} className="text-xs font-semibold text-[var(--blue)]">Done</button>
                              ) : (p.blocks?.length ?? 0) > 0 ? (
                                <>
                                  <button type="button" onClick={() => setEditingKey(p.key)} className="text-xs font-semibold text-[var(--blue)]">Design</button>
                                  <button type="button" onClick={resetCover} className="text-xs text-[var(--text-muted)] hover:underline">Reset</button>
                                </>
                              ) : (
                                <button type="button" onClick={customizeCover} className="text-xs font-semibold text-[var(--blue)]">Customize</button>
                              )
                            )}
                            {COPY_FIELDS[p.type] && (
                              <button type="button" onClick={() => setCopyEditKey(copyEditKey === p.key ? null : p.key)} className="text-xs font-semibold text-[var(--blue)]">{copyEditKey === p.key ? "Done" : "Edit"}</button>
                            )}
                            <span className="text-[10px] font-semibold text-[var(--text-muted)]"><i className="ti ti-lock" aria-hidden="true" /> required</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            {COPY_FIELDS[p.type] && p.included && <button type="button" onClick={() => setCopyEditKey(copyEditKey === p.key ? null : p.key)} className="mr-1 text-xs font-semibold text-[var(--blue)]">{copyEditKey === p.key ? "Done" : "Edit"}</button>}
                            {isFreeform && <button type="button" onClick={() => setEditingKey(editingKey === p.key ? null : p.key)} className="mr-1 text-xs font-semibold text-[var(--blue)]">{editingKey === p.key ? "Done" : "Design"}</button>}
                            <button type="button" onClick={() => move(i, -1)} disabled={i <= 2} className="text-xs text-[var(--text-muted)] disabled:opacity-30">↑</button>
                            <button type="button" onClick={() => move(i, 1)} disabled={i >= pages.length - 1} className="text-xs text-[var(--text-muted)] disabled:opacity-30">↓</button>
                            {(isCustom || isFreeform) && <button type="button" onClick={() => duplicatePage(i)} className="text-xs text-[var(--text-muted)] hover:text-[var(--blue)]" title="Duplicate page">⧉</button>}
                            {(isCustom || isFreeform) && <button type="button" onClick={() => { if (editingKey === p.key) setEditingKey(null); removePage(i); }} className="text-xs text-rose-500" title="Remove page"><i className="ti ti-x" aria-hidden="true" /></button>}
                          </span>
                        )}
                      </div>
                      {isCustom && p.included && (
                        <div className="mt-2 space-y-1.5">
                          <input value={p.custom?.heading ?? ""} onChange={(e) => editCustom(i, { heading: e.target.value })} placeholder="Page heading" className="w-full rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs" />
                          <textarea value={p.custom?.body ?? ""} onChange={(e) => editCustom(i, { body: e.target.value })} placeholder="Body text" rows={3} className="w-full rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs" />
                        </div>
                      )}
                      {COPY_FIELDS[p.type] && copyEditKey === p.key && (
                        <div className="mt-2 space-y-2 border-t border-[var(--border-subtle)] pt-2">
                          {COPY_FIELDS[p.type].map((f) => (
                            <div key={f.field}>
                              <label className="text-[11px] font-semibold text-[var(--navy)]">{f.label}</label>
                              {f.kind === "textarea" ? (
                                <textarea value={ovVal(p.type, f.field)} onChange={(e) => setOverride(p.type, f.field, e.target.value)} placeholder={f.placeholder} rows={3} className="mt-0.5 w-full rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs" />
                              ) : (
                                <input value={ovVal(p.type, f.field)} onChange={(e) => setOverride(p.type, f.field, e.target.value)} placeholder={f.placeholder} className="mt-0.5 w-full rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs" />
                              )}
                            </div>
                          ))}
                          <p className="text-[10px] text-[var(--text-muted)]">Blank uses the default. Session/presenter/sponsor lists are pulled from the event.</p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 flex gap-3">
                <button type="button" onClick={addCustomPage} className="text-xs font-semibold text-[var(--blue)] hover:underline">＋ Add custom page</button>
                <button type="button" onClick={addDesignPage} className="text-xs font-semibold text-[var(--blue)] hover:underline">＋ Add design page</button>
              </div>
            </div>

            {generated ? (
              <div className="space-y-2">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <p className="font-semibold">Edition generated.</p>
                  <p className="mt-1">Snapshot frozen; print &amp; digital PDFs rendered.</p>
                </div>
                {pdfWarning && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{pdfWarning}</div>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <a href={`/api/admin/events/brochure/${editionId}/download?variant=digital`} className="font-semibold text-[var(--blue)] hover:underline">Digital PDF</a>
                  <a href={`/api/admin/events/brochure/${editionId}/download?variant=print`} className="font-semibold text-[var(--blue)] hover:underline">Print PDF (bleed)</a>
                  <a href={`/api/admin/events/brochure/${editionId}/qr`} target="_blank" rel="noreferrer" className="font-semibold text-[var(--blue)] hover:underline">QR code</a>
                  {!pdfWarning && (
                    <button type="button" onClick={togglePublish} disabled={busy} className="font-semibold text-[var(--blue)] hover:underline disabled:opacity-50">{published ? "Unpublish" : "Publish to event page"}</button>
                  )}
                  {published && eventId && (
                    <Link href={`/admin/events/email?eventId=${eventId}&type=booklet&bookletEditionId=${editionId}`} className="font-semibold text-[var(--blue)] hover:underline">Send booklet →</Link>
                  )}
                </div>
                <Link href="/admin/events/brochure" className="inline-block text-sm font-semibold text-[var(--text-muted)] underline">Back to editions</Link>
              </div>
            ) : (
              <button type="button" onClick={generate} disabled={busy || carried.length > 0} title={carried.length > 0 ? "Review carried-over copy first" : undefined} className="cap-btn-primary w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
                {busy ? "Working…" : carried.length > 0 ? `Review ${carried.length} carried page${carried.length > 1 ? "s" : ""} first` : "Generate edition (freeze snapshot + PDFs)"}
              </button>
            )}
            <p className="text-[11px] text-[var(--text-muted)]">Disclaimers &amp; footer are locked into every edition. Edit event data at the source, not here.</p>
          </div>

          {/* preview / canvas */}
          <div className="min-w-0 flex-1">
            {editingPage ? (
              <>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">{editingPage.type === "cover" ? "Cover · custom layout" : "Design page · free-form canvas"}</p>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-slate-100 p-3">
                  <BrochureCanvas size={size} blocks={editingPage.blocks ?? []} onChange={(b) => setBlocks(editingPage.key, b)} sourceTitle={editingPage.type === "cover" ? source?.title : undefined} />
                </div>
              </>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Booklet preview {busy && <span className="font-normal">· rendering…</span>}</p>
                  <span className="text-[10px] text-[var(--text-muted)]">Fit · {Math.round((previewW ? Math.min(1, previewW / PAGE_PX[size][0]) : 0.6) * 100)}%</span>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-slate-200 p-3">
                  <div ref={previewRef} className="overflow-auto" style={{ maxHeight: 700 }}>
                    {(() => {
                      const [pw, ph] = PAGE_PX[size];
                      const includedCount = Math.max(1, pages.filter((p) => p.included).length);
                      const docH = includedCount * (ph + 16) + 24;
                      const fit = previewW ? Math.min(1, previewW / pw) : 0.6;
                      return (
                        <div style={{ width: pw * fit, height: docH * fit, margin: "0 auto" }}>
                          <iframe title="Booklet preview" srcDoc={html} style={{ width: pw, height: docH, transform: `scale(${fit})`, transformOrigin: "top left", border: "none", background: "#dfe3ea", display: "block" }} />
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
