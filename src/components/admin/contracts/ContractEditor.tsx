"use client";

// Edit content inside the master's locked layout. Each Word paragraph is an
// editable block; fields show as chips (amber = required and open, blue = set).
// Only bold, italic, new list items and paragraph removal are offered: style,
// font, margins and numbering come from the master and are not editable. The
// true render (CloudConvert, Word engine) is one click away in the preview tab.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { openFields } from "@/lib/contracts/fields";
import type { BodyEdits, IssuingEntity, Segment, TemplateField } from "@/lib/contracts/types";
import type { ModelBlock, ModelParagraph, ModelSegment } from "@/lib/contracts/docx-engine";
import { api, BLUE, btn, MUTED, NAVY, Notice } from "./ui";

export type EditorData = {
  doc: { id: string; version: number; status: string; locked: boolean; entity_id: string | null; field_values: Record<string, string>; body_edits: BodyEdits; updated_at: string };
  template: { id: string; name: string; kind: string; version: number; entity_match: string | null; has_expiry: boolean };
  fields: TemplateField[];
  entities: IssuingEntity[];
  blocks: ModelBlock[];
  renderConfigured: boolean;
};

export type EditorHandle = { flush: () => Promise<void> };

const TOKEN_RE = /\{\{([a-z0-9_]+)\}\}/g;
const AUTOSAVE_MS = 3000;

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sameSegments(a: Segment[], b: Segment[]): boolean {
  const norm = (s: Segment[]) => {
    const out: Segment[] = [];
    for (const x of s) {
      if (!x.text) continue;
      const last = out[out.length - 1];
      if (last && Boolean(last.b) === Boolean(x.b) && Boolean(last.i) === Boolean(x.i)) last.text += x.text;
      else out.push({ text: x.text, b: Boolean(x.b), i: Boolean(x.i) });
    }
    return JSON.stringify(out);
  };
  return norm(a) === norm(b);
}

/** DOM of an editable paragraph → segments. Chips become {{token}} again. */
function parseParagraph(el: HTMLElement): Segment[] {
  const out: Segment[] = [];
  const push = (text: string, f: { b: boolean; i: boolean }) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && Boolean(last.b) === f.b && Boolean(last.i) === f.i) last.text += text;
    else out.push({ text, ...(f.b ? { b: true } : {}), ...(f.i ? { i: true } : {}) });
  };
  const walk = (node: Node, f: { b: boolean; i: boolean }) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        push((child.textContent ?? "").replace(/ /g, " "), f);
        return;
      }
      if (!(child instanceof HTMLElement)) return;
      const tok = child.dataset.token;
      if (tok) return push(`{{${tok}}}`, f);
      if (child.tagName === "BR") return push("\n", f);
      const st = child.style;
      const next = {
        b: f.b || child.tagName === "B" || child.tagName === "STRONG" || st.fontWeight === "bold" || Number(st.fontWeight) >= 600,
        i: f.i || child.tagName === "I" || child.tagName === "EM" || st.fontStyle === "italic",
      };
      if ((child.tagName === "DIV" || child.tagName === "P") && out.length) push("\n", f);
      walk(child, next);
    });
  };
  walk(el, { b: false, i: false });
  // An emptied paragraph keeps a lone <br> as the caret placeholder; that is not content.
  if (out.length === 1 && out[0].text === "\n") return [];
  return out.filter((s) => s.text);
}

type ChipInfo = { label: string; value: string | null; required: boolean };

function chipHtml(token: string, info: ChipInfo | undefined): string {
  const set = Boolean(info?.value);
  const cls = set ? "ctr-chip ctr-chip-set" : info?.required === false ? "ctr-chip ctr-chip-opt" : "ctr-chip ctr-chip-open";
  const text = set ? info!.value! : info?.label ?? token;
  return `<span contenteditable="false" data-token="${esc(token)}" class="${cls}" title="${esc(info?.label ?? token)}">${esc(text)}</span>`;
}

function segmentsHtml(segs: ModelSegment[], chips: Record<string, ChipInfo>): string {
  return segs
    .map((s) => {
      let html = "";
      let last = 0;
      for (const m of s.text.matchAll(TOKEN_RE)) {
        html += esc(s.text.slice(last, m.index)).replace(/\n/g, "<br>");
        html += chipHtml(m[1], chips[m[1]]);
        last = (m.index ?? 0) + m[0].length;
      }
      html += esc(s.text.slice(last)).replace(/\n/g, "<br>");
      if (s.hl) html = `<span class="ctr-hl">${html}</span>`;
      if (s.i) html = `<i>${html}</i>`;
      if (s.b) html = `<b>${html}</b>`;
      return html;
    })
    .join("");
}

function Paragraph({
  p,
  segments,
  chips,
  readOnly,
  edited,
  onChange,
  onFocus,
  onChip,
  onEnter,
}: {
  p: ModelParagraph | { id: string; style: null; numbered: boolean; align: null; locked: false };
  segments: ModelSegment[];
  chips: Record<string, ChipInfo>;
  readOnly: boolean;
  edited: boolean;
  onChange: (id: string, segs: Segment[]) => void;
  onFocus: (id: string) => void;
  onChip: (token: string, el: HTMLElement) => void;
  onEnter: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => segmentsHtml(segments, chips), [segments, chips]);
  const focused = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!focused.current) {
      if (el.innerHTML !== html) el.innerHTML = html || "<br>";
    } else {
      // While typing, refresh chips in place so the caret stays put.
      el.querySelectorAll<HTMLElement>("[data-token]").forEach((c) => {
        const info = chips[c.dataset.token ?? ""];
        const set = Boolean(info?.value);
        c.textContent = set ? info!.value! : info?.label ?? c.dataset.token ?? "";
        c.className = set ? "ctr-chip ctr-chip-set" : info?.required === false ? "ctr-chip ctr-chip-opt" : "ctr-chip ctr-chip-open";
      });
    }
  }, [html, chips]);

  const heading = /heading|title/i.test(p.style ?? "");
  const editable = !readOnly && !p.locked;
  return (
    <div style={{ position: "relative", display: "flex", gap: 6 }}>
      <span aria-hidden="true" style={{ width: 10, flexShrink: 0, color: "#b8bfcc", fontSize: 10, paddingTop: 4 }} title={p.numbered ? "List item (numbering from the master)" : undefined}>
        {p.numbered ? "•" : edited ? "✎" : ""}
      </span>
      <div
        ref={ref}
        className="ctr-para"
        contentEditable={editable}
        suppressContentEditableWarning
        data-pid={p.id}
        onFocus={() => {
          focused.current = true;
          onFocus(p.id);
        }}
        onBlur={() => {
          focused.current = false;
        }}
        onInput={(e) => editable && onChange(p.id, parseParagraph(e.currentTarget))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onEnter(p.id);
          }
        }}
        onClick={(e) => {
          const t = (e.target as HTMLElement).closest<HTMLElement>("[data-token]");
          if (t?.dataset.token && !readOnly) onChip(t.dataset.token, t);
        }}
        style={{
          flex: 1,
          minHeight: 18,
          outline: "none",
          whiteSpace: "pre-wrap",
          textAlign: (p.align === "center" ? "center" : p.align === "right" ? "right" : p.align === "both" ? "justify" : "left") as "left",
          fontWeight: heading ? 700 : undefined,
          color: p.locked ? "#8a93a6" : undefined,
          borderRadius: 4,
          padding: "1px 4px",
          background: edited ? "#f6f9ff" : undefined,
        }}
      />
    </div>
  );
}

export const ContractEditor = forwardRef<EditorHandle, { data: EditorData; onOpenChange?: (open: number) => void; onSaved?: () => void }>(function ContractEditor(
  { data, onOpenChange, onSaved },
  ref,
) {
  const readOnly = data.doc.locked;
  const [values, setValues] = useState<Record<string, string>>(data.doc.field_values);
  const [edits, setEdits] = useState<BodyEdits>(data.doc.body_edits);
  const [entityId, setEntityId] = useState<string | null>(data.doc.entity_id);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(data.doc.updated_at);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [chipEdit, setChipEdit] = useState<{ token: string; top: number; left: number } | null>(null);
  const [pane, setPane] = useState<"terms" | "preview">("terms");
  const [previewKey, setPreviewKey] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ values, edits, entityId, dirty });
  useLayoutEffect(() => {
    stateRef.current = { values, edits, entityId, dirty };
  });
  const counter = useRef(Object.keys(data.doc.body_edits.inserted ?? []).length + 1);

  const entity = data.entities.find((e) => e.id === entityId) ?? null;
  const needsEntity = Boolean(data.template.entity_match);
  const open = useMemo(() => openFields(data.fields, values, entity, needsEntity), [data.fields, values, entity, needsEntity]);
  useEffect(() => onOpenChange?.(open.length), [open.length, onOpenChange]);

  const chips = useMemo(() => {
    const out: Record<string, ChipInfo> = {};
    for (const f of data.fields) {
      const v = (values[f.token] ?? f.default_value ?? "").trim();
      out[f.token] = { label: f.label, value: v || null, required: f.required };
    }
    out.issuing_entity = { label: "Issuing entity", value: entity?.legal_name ?? null, required: true };
    return out;
  }, [data.fields, values, entity]);

  const save = useCallback(
    async (keepalive = false) => {
      if (readOnly || !stateRef.current.dirty) return;
      const s = stateRef.current;
      setDirty(false);
      const res = await fetch(`/api/admin/sales/contracts/${data.doc.id}`, {
        method: "PATCH",
        keepalive,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field_values: s.values, body_edits: s.edits, entity_id: s.entityId }),
      }).catch(() => null);
      if (!res || !res.ok) {
        const j = res ? await res.json().catch(() => ({})) : {};
        setSaveError((j as { error?: string }).error ?? "Not saved. Check your connection.");
        setDirty(true);
        return;
      }
      setSaveError(null);
      setSavedAt(new Date().toISOString());
      onSaved?.();
    },
    [data.doc.id, readOnly, onSaved],
  );

  useImperativeHandle(ref, () => ({ flush: () => save() }), [save]);

  // Autosave 3 seconds after the last change; also on hide, unload and unmount.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [dirty, values, edits, entityId, save]);
  useEffect(() => {
    const flush = () => void save(true);
    const onVis = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVis);
      flush();
    };
  }, [save]);

  const touch = () => setDirty(true);
  const setValue = (token: string, v: string) => {
    setValues((cur) => ({ ...cur, [token]: v }));
    touch();
  };

  const originals = useMemo(() => {
    const m = new Map<string, ModelParagraph>();
    const add = (p: ModelParagraph) => m.set(p.id, p);
    for (const b of data.blocks) {
      if (b.type === "p") add(b.p);
      else b.rows.forEach((r) => r.forEach((c) => c.forEach(add)));
    }
    return m;
  }, [data.blocks]);

  const onParaChange = useCallback(
    (id: string, segs: Segment[]) => {
      setEdits((cur) => {
        const inserted = cur.inserted.find((x) => x.id === id);
        if (inserted) {
          if (sameSegments(inserted.segments, segs)) return cur;
          return { ...cur, inserted: cur.inserted.map((x) => (x.id === id ? { ...x, segments: segs } : x)) };
        }
        const orig = originals.get(id);
        const base = cur.edits[id] ?? orig?.segments ?? [];
        if (cur.edits[id] !== null && sameSegments(base, segs)) return cur;
        const nextEdits = { ...cur.edits };
        if (orig && sameSegments(orig.segments, segs)) delete nextEdits[id];
        else nextEdits[id] = segs;
        return { ...cur, edits: nextEdits };
      });
      touch();
    },
    [originals],
  );

  const insertAfter = (id: string) => {
    if (readOnly) return;
    const nid = `n${Date.now().toString(36)}${counter.current++}`;
    setEdits((cur) => ({ ...cur, inserted: [...cur.inserted, { id: nid, after: id, segments: [] }] }));
    touch();
    setTimeout(() => bodyRef.current?.querySelector<HTMLElement>(`[data-pid="${nid}"]`)?.focus(), 30);
  };
  const removeParagraph = (id: string) => {
    if (readOnly) return;
    setEdits((cur) =>
      cur.inserted.some((x) => x.id === id)
        ? { ...cur, inserted: cur.inserted.filter((x) => x.id !== id && x.after !== id) }
        : { ...cur, edits: { ...cur.edits, [id]: null } },
    );
    touch();
  };
  const restoreParagraph = (id: string) => {
    setEdits((cur) => {
      const next = { ...cur.edits };
      delete next[id];
      return { ...cur, edits: next };
    });
    touch();
  };

  const onChip = (token: string, el: HTMLElement) => {
    const host = bodyRef.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!host) return;
    if (token === "issuing_entity") {
      document.getElementById(`entity-${data.doc.id}`)?.focus();
      return;
    }
    setChipEdit({ token, top: r.bottom - host.top + (bodyRef.current?.scrollTop ?? 0) + 4, left: Math.max(0, r.left - host.left) });
  };

  const renderPara = (p: ModelParagraph, key?: string) => {
    const e = edits.edits[p.id];
    const deleted = e === null;
    const after = edits.inserted.filter((x) => x.after === p.id);
    const chain: typeof after = [];
    const walk = (anchor: string) => edits.inserted.filter((x) => x.after === anchor).forEach((x) => { chain.push(x); walk(x.id); });
    walk(p.id);
    return (
      <div key={key ?? p.id}>
        {deleted ? (
          <div style={{ fontSize: 11.5, color: "#A32D2D", padding: "2px 16px", display: "flex", gap: 8 }}>
            <span style={{ textDecoration: "line-through", opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 360 }}>{p.segments.map((s) => s.text).join("")}</span>
            {!readOnly ? <button type="button" onClick={() => restoreParagraph(p.id)} style={{ border: "none", background: "none", color: BLUE, cursor: "pointer", fontSize: 11.5 }}>Restore</button> : null}
          </div>
        ) : (
          <Paragraph p={p} segments={e ?? p.segments} chips={chips} readOnly={readOnly} edited={e !== undefined} onChange={onParaChange} onFocus={setFocusId} onChip={onChip} onEnter={insertAfter} />
        )}
        {after.length || chain.length
          ? chain.map((x) => (
              <Paragraph key={x.id} p={{ id: x.id, style: null, numbered: p.numbered, align: null, locked: false }} segments={x.segments} chips={chips} readOnly={readOnly} edited onChange={onParaChange} onFocus={setFocusId} onChip={onChip} onEnter={insertAfter} />
            ))
          : null}
      </div>
    );
  };

  const exec = (cmd: "bold" | "italic") => {
    if (readOnly) return;
    document.execCommand(cmd);
    const el = focusId ? bodyRef.current?.querySelector<HTMLElement>(`[data-pid="${focusId}"]`) : null;
    if (el) onParaChange(focusId!, parseParagraph(el));
  };

  const editedCount = Object.keys(edits.edits).length + edits.inserted.length;
  const download = (url: string) => {
    if (open.length) {
      setNotice(`Fill the open fields first: ${open.map((f) => f.label).join(", ")}.`);
      return;
    }
    void save().then(() => {
      window.location.href = url;
    });
  };

  return (
    <div>
      <style>{`
        .ctr-chip{border-radius:4px;padding:0 5px;cursor:pointer;white-space:nowrap}
        .ctr-chip-open{background:#fff4d6;border:1px solid #e0a800;color:#0A1A40;font-weight:700}
        .ctr-chip-opt{background:#f6f8fc;border:1px dashed #b9cbe6;color:#5a6b87}
        .ctr-chip-set{background:#e8f0fe;border:1px solid #c8d6ea;color:#185FA5}
        .ctr-hl{background:#fffbe0}
        .ctr-para:focus{box-shadow:0 0 0 1px #c8d6ea}
      `}</style>

      {/* Tab actions: Save, Preview full, PDF, Export */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", flexWrap: "wrap", padding: "8px 14px", background: NAVY }}>
        <span style={{ fontSize: 11, color: saveError ? "#ffb4b4" : "#9fb6d8", marginRight: "auto" }}>
          {data.template.name} · v{data.doc.version}
          {readOnly ? " · sent, locked" : saveError ? ` · ${saveError}` : dirty ? " · unsaved" : savedAt ? ` · saved ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
        </span>
        {!readOnly ? <button type="button" onClick={() => void save()} style={darkBtn}>Save</button> : null}
        <button
          type="button"
          disabled={!data.renderConfigured}
          title={data.renderConfigured ? "True render in a new tab" : "Rendering is not configured"}
          onClick={() => void save().then(() => window.open(`/api/admin/sales/contracts/${data.doc.id}/pdf?kind=preview`, "_blank"))}
          style={{ ...darkBtn, opacity: data.renderConfigured ? 1 : 0.5 }}
        >
          Preview full
        </button>
        <button type="button" disabled={!data.renderConfigured} title={open.length ? "Fill the open fields to download" : "Download PDF"} onClick={() => download(`/api/admin/sales/contracts/${data.doc.id}/pdf?kind=final&download=1`)} style={{ ...darkBtn, opacity: data.renderConfigured && !open.length ? 1 : 0.5 }}>
          PDF
        </button>
        <span style={{ position: "relative" }}>
          <button type="button" onClick={() => setExportOpen((v) => !v)} style={darkBtn}>Export ▾</button>
          {exportOpen ? (
            <span style={{ position: "absolute", right: 0, top: 34, zIndex: 30, background: "#fff", border: "0.5px solid #d5deea", borderRadius: 8, boxShadow: "0 6px 18px rgba(12,35,64,.14)", minWidth: 170, overflow: "hidden" }}>
              <button type="button" onClick={() => { setExportOpen(false); download(`/api/admin/sales/contracts/${data.doc.id}/docx`); }} style={menuItem}>Word (.docx)</button>
              <button type="button" disabled={!data.renderConfigured} onClick={() => { setExportOpen(false); download(`/api/admin/sales/contracts/${data.doc.id}/pdf?kind=final&download=1`); }} style={{ ...menuItem, opacity: data.renderConfigured ? 1 : 0.5 }}>PDF</button>
            </span>
          ) : null}
        </span>
      </div>

      {/* Entity bar */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", padding: "12px 16px", background: "#f6f9ff", borderBottom: "0.5px solid #e4eaf3", flexWrap: "wrap" }}>
        {needsEntity ? (
          <label style={{ flex: "1 1 260px" }}>
            <span style={labelStyle}>Issuing entity · required</span>
            <select
              id={`entity-${data.doc.id}`}
              disabled={readOnly}
              value={entityId ?? ""}
              onChange={(e) => {
                setEntityId(e.target.value || null);
                touch();
              }}
              style={{ width: "100%", border: `1px solid ${entityId ? BLUE : "#e0a800"}`, borderRadius: 7, padding: "8px 10px", fontSize: 13, background: entityId ? "#fff" : "#fff4d6", color: NAVY, fontWeight: 600 }}
            >
              <option value="">Choose the iCFO entity…</option>
              {data.entities.map((e) => (
                <option key={e.id} value={e.id}>{e.legal_name}</option>
              ))}
            </select>
            <span style={{ fontSize: 11, color: MUTED, display: "block", marginTop: 4 }}>Fills the party name, signature block and every other mention of the entity in the body.</span>
          </label>
        ) : null}
        <div style={{ flex: "1 1 220px", fontSize: 11.5, color: MUTED, lineHeight: 1.6 }}>
          <span style={labelStyle}>Letterhead</span>
          Header, logo, address and footer come from the master unchanged.
        </div>
      </div>

      {notice ? <div style={{ padding: "8px 16px" }}><Notice tone="warn">{notice}</Notice></div> : null}

      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {/* Document */}
        <div style={{ flex: "1.3 1 420px", minWidth: 0, background: "#fbfcff", borderRight: "0.5px solid #eef1f5" }}>
          <div style={{ display: "flex", gap: 4, padding: "8px 14px", borderBottom: "0.5px solid #e4eaf3", background: "#f6f8fc", fontSize: 12, color: MUTED, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" disabled={readOnly} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")} style={toolBtn} aria-label="Bold"><b>B</b></button>
            <button type="button" disabled={readOnly} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")} style={toolBtn} aria-label="Italic"><i>I</i></button>
            <button type="button" disabled={readOnly || !focusId} onMouseDown={(e) => e.preventDefault()} onClick={() => focusId && insertAfter(focusId)} style={toolBtn} title="New paragraph or list item after this one (keeps its numbering)">≡ +</button>
            <button type="button" disabled={readOnly || !focusId} onMouseDown={(e) => e.preventDefault()} onClick={() => focusId && removeParagraph(focusId)} style={toolBtn} title="Remove this paragraph">≡ −</button>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11 }}>{editedCount ? `${editedCount} paragraph${editedCount === 1 ? "" : "s"} edited · ` : ""}Styles locked to template</span>
          </div>
          <div ref={bodyRef} style={{ position: "relative", padding: "16px 18px", fontSize: 12.5, lineHeight: 1.85, color: "#3a4a63", maxHeight: "62vh", overflowY: "auto", fontFamily: "Georgia, 'Times New Roman', serif" }}>
            {data.blocks.map((b, i) =>
              b.type === "p" ? (
                renderPara(b.p, `p${b.p.id}`)
              ) : (
                <table key={`t${i}`} style={{ width: "100%", borderCollapse: "collapse", margin: "6px 0" }}>
                  <tbody>
                    {b.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{ verticalAlign: "top", border: "0.5px dashed #dde3ee", padding: "3px 4px" }}>
                            {cell.map((p) => renderPara(p))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ),
            )}
            {chipEdit ? (
              <ChipPopover
                field={data.fields.find((f) => f.token === chipEdit.token)}
                value={values[chipEdit.token] ?? data.fields.find((f) => f.token === chipEdit.token)?.default_value ?? ""}
                top={chipEdit.top}
                left={chipEdit.left}
                onChange={(v) => setValue(chipEdit.token, v)}
                onClose={() => setChipEdit(null)}
              />
            ) : null}
          </div>
        </div>

        {/* Terms and true preview */}
        <div style={{ flex: "1 1 320px", minWidth: 0, background: "#eef1f5" }}>
          <div style={{ display: "flex", gap: 2, padding: "6px 10px 0", background: "#f6f8fc", borderBottom: "0.5px solid #e4eaf3" }}>
            {(["terms", "preview"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setPane(k)} style={{ border: "none", background: "none", borderBottom: pane === k ? `2px solid ${BLUE}` : "2px solid transparent", color: pane === k ? NAVY : MUTED, fontWeight: pane === k ? 700 : 500, fontSize: 12, padding: "6px 10px", cursor: "pointer" }}>
                {k === "terms" ? `Terms${open.length ? ` · ${open.length} open` : ""}` : "True preview"}
              </button>
            ))}
          </div>
          {pane === "terms" ? (
            <div style={{ padding: "12px 14px", maxHeight: "62vh", overflowY: "auto" }}>
              {data.fields.map((f) => (
                <FieldInput key={f.token} field={f} value={values[f.token] ?? f.default_value ?? ""} readOnly={readOnly} onChange={(v) => setValue(f.token, v)} />
              ))}
            </div>
          ) : (
            <div style={{ padding: 12 }}>
              {!data.renderConfigured ? (
                <Notice tone="warn">True preview needs PDF rendering. Add CLOUDCONVERT_API_KEY in Vercel; nothing else changes.</Notice>
              ) : previewKey === null ? (
                <div style={{ textAlign: "center", padding: "30px 10px" }}>
                  <p style={{ fontSize: 12.5, color: MUTED, margin: "0 0 10px" }}>Renders through the same Word engine as the copy that gets signed. Open fields show as [Label].</p>
                  <button type="button" onClick={() => void save().then(() => setPreviewKey(Date.now()))} style={btn(true)}>Render preview</button>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: MUTED, marginBottom: 6 }}>
                    <span>Rendered {new Date(previewKey).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    <button type="button" onClick={() => void save().then(() => setPreviewKey(Date.now()))} style={{ ...btn(), padding: "4px 10px", fontSize: 11.5 }}>Refresh</button>
                  </div>
                  <iframe key={previewKey} title="True preview" src={`/api/admin/sales/contracts/${data.doc.id}/pdf?kind=preview&t=${previewKey}`} style={{ width: "100%", height: "58vh", border: "0.5px solid #d5deea", borderRadius: 6, background: "#fff" }} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const darkBtn = { border: "1px solid #2f4a74", background: "#13294a", color: "#dce8f7", fontSize: 11.5, fontWeight: 600, padding: "6px 11px", borderRadius: 6, cursor: "pointer" } as const;
const menuItem = { display: "block", width: "100%", textAlign: "left", padding: "9px 14px", border: "none", background: "#fff", fontSize: 12.5, color: NAVY, cursor: "pointer" } as const;
const toolBtn = { padding: "3px 8px", border: "0.5px solid #d5deea", borderRadius: 5, background: "#fff", cursor: "pointer", fontSize: 12, color: "#3a4a63" } as const;
const labelStyle = { display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8a93a6", marginBottom: 5 } as const;

function FieldInput({ field, value, readOnly, onChange }: { field: TemplateField; value: string; readOnly: boolean; onChange: (v: string) => void }) {
  const open = field.required && !value.trim();
  const common = { width: "100%", boxSizing: "border-box" as const, border: `1px solid ${open ? "#e0a800" : "#d5deea"}`, background: open ? "#fff4d6" : "#fff", borderRadius: 7, padding: "7px 9px", fontSize: 12.5, color: NAVY, fontFamily: "inherit" };
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: "#3a4a63" }}>
        {field.label}
        {field.required ? <span style={{ color: open ? "#8a6500" : "#8a93a6" }}> *</span> : null}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
        {field.type === "currency" ? <span style={{ fontSize: 12, color: MUTED }}>$</span> : null}
        {field.type === "multiline" ? (
          <textarea rows={3} value={value} disabled={readOnly} onChange={(e) => onChange(e.target.value)} style={common} />
        ) : (
          <input type={field.type === "date" ? "date" : "text"} value={value} disabled={readOnly} onChange={(e) => onChange(e.target.value)} inputMode={field.type === "currency" || field.type === "percent" ? "decimal" : undefined} style={common} />
        )}
        {field.type === "percent" ? <span style={{ fontSize: 12, color: MUTED }}>%</span> : null}
      </span>
    </label>
  );
}

function ChipPopover({ field, value, top, left, onChange, onClose }: { field: TemplateField | undefined; value: string; top: number; left: number; onChange: (v: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(value);
  if (!field) return null;
  const commit = () => {
    onChange(draft);
    onClose();
  };
  return (
    <div style={{ position: "absolute", top, left, zIndex: 20, width: 260, background: "#fff", border: "0.5px solid #d5deea", borderRadius: 9, boxShadow: "0 8px 22px rgba(12,35,64,.16)", padding: 10, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: NAVY, marginBottom: 6 }}>{field.label}</div>
      {field.type === "multiline" ? (
        <textarea autoFocus rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} style={{ width: "100%", boxSizing: "border-box", border: "0.5px solid #cbd5e1", borderRadius: 6, padding: 7, fontSize: 12.5 }} />
      ) : (
        <input
          autoFocus
          type={field.type === "date" ? "date" : "text"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") onClose();
          }}
          style={{ width: "100%", boxSizing: "border-box", border: "0.5px solid #cbd5e1", borderRadius: 6, padding: 7, fontSize: 12.5 }}
        />
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 8 }}>
        <button type="button" onClick={onClose} style={{ ...btn(), padding: "4px 10px", fontSize: 11.5 }}>Cancel</button>
        <button type="button" onClick={commit} style={{ ...btn(true), padding: "4px 10px", fontSize: 11.5 }}>Set</button>
      </div>
    </div>
  );
}

export async function loadEditorData(id: string): Promise<{ data?: EditorData & Record<string, unknown>; error?: string }> {
  const r = await api<EditorData & Record<string, unknown>>(`/api/admin/sales/contracts/${id}`);
  return r.ok ? { data: r.data } : { error: r.data.error ?? "Could not load the document." };
}
