"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useRef, useState } from "react";
import { TRIM_POINTS, type BrochureSize, type FreeformBlock, type FreeformBlockType } from "@/lib/event-hub/brochure/types";

function genId(prefix: string): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${prefix}-${Date.now()}`;
}

const DISPLAY_W = 460; // px the page is drawn at; blocks stored in PDF points
const PALETTE: { type: FreeformBlockType; label: string }[] = [
  { type: "heading", label: "Heading" },
  { type: "text", label: "Text" },
  { type: "callout", label: "Callout" },
  { type: "image", label: "Image" },
  { type: "divider", label: "Divider" },
];

function seed(type: FreeformBlockType, id: string): FreeformBlock {
  const base = { id, x: 60, y: 90, align: "left" as const };
  switch (type) {
    case "heading": return { ...base, type, w: 400, h: 30, text: "Heading", fontSize: 24 };
    case "text": return { ...base, type, w: 400, h: 70, text: "Body copy.", fontSize: 13 };
    case "callout": return { ...base, type, w: 340, h: 70, text: "Callout copy.", fontSize: 13, bg: "#f2f6fc" };
    case "image": return { ...base, type, w: 240, h: 150 };
    case "divider": return { ...base, type, w: 400, h: 2, color: "#0c2340" };
  }
}

export function BrochureCanvas({
  size,
  blocks,
  onChange,
}: {
  size: BrochureSize;
  blocks: FreeformBlock[];
  onChange: (blocks: FreeformBlock[]) => void;
}) {
  const [tw, th] = TRIM_POINTS[size];
  const scale = DISPLAY_W / tw;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const drag = useRef<{ id: string; mode: "move" | "resize"; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null);
  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  const update = useCallback((id: string, patch: Partial<FreeformBlock>) => {
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, [blocks, onChange]);

  function addBlock(type: FreeformBlockType) {
    const id = genId("b");
    onChange([...blocks, seed(type, id)]);
    setSelectedId(id);
  }
  function removeSelected() {
    if (!selectedId) return;
    onChange(blocks.filter((b) => b.id !== selectedId));
    setSelectedId(null);
  }

  function onPointerDown(e: React.PointerEvent, b: FreeformBlock, mode: "move" | "resize") {
    e.preventDefault(); e.stopPropagation();
    setSelectedId(b.id);
    drag.current = { id: b.id, mode, sx: e.clientX, sy: e.clientY, ox: b.x, oy: b.y, ow: b.w, oh: b.h };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / scale;
    const dy = (e.clientY - d.sy) / scale;
    if (d.mode === "move") {
      update(d.id, { x: Math.max(0, Math.round(d.ox + dx)), y: Math.max(0, Math.round(d.oy + dy)) });
    } else {
      update(d.id, { w: Math.max(24, Math.round(d.ow + dx)), h: Math.max(2, Math.round(d.oh + dy)) });
    }
  }
  function onPointerUp() { drag.current = null; }

  async function onImageFile(file: File) {
    if (!selected || selected.type !== "image") return;
    const reader = new FileReader();
    reader.onload = () => update(selected.id, { imageUrl: String(reader.result) });
    reader.readAsDataURL(file);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_200px]">
      <div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PALETTE.map((p) => (
            <button key={p.type} type="button" onClick={() => addBlock(p.type)} className="rounded-md border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--navy)] hover:border-[var(--blue)]">+ {p.label}</button>
          ))}
        </div>
        <div
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onClick={() => setSelectedId(null)}
          style={{ position: "relative", width: DISPLAY_W, height: th * scale, background: "#fff", border: "1px solid #cbd5e1", boxShadow: "0 6px 20px rgba(12,35,64,.12)", margin: "0 auto", overflow: "hidden" }}
        >
          {blocks.map((b) => {
            const isSel = b.id === selectedId;
            const common: React.CSSProperties = {
              position: "absolute", left: b.x * scale, top: b.y * scale, width: b.w * scale, height: b.h * scale,
              outline: isSel ? "1.5px solid #2E78F5" : "1px dashed transparent", cursor: "move", boxSizing: "border-box",
            };
            let inner: React.ReactNode = null;
            if (b.type === "divider") inner = <div style={{ width: "100%", height: "100%", background: b.color ?? "#0c2340" }} />;
            else if (b.type === "image") inner = b.imageUrl
              ? <img src={b.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ width: "100%", height: "100%", background: "#eef2f8", border: "1px dashed #aab4c6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#6a7690" }}>Image</div>;
            else inner = (
              <div style={{ width: "100%", height: "100%", textAlign: b.align ?? "left", fontSize: (b.fontSize ?? 13) * scale, color: b.color ?? (b.type === "heading" ? "#0c2340" : "#1e2a3a"), fontWeight: b.type === "heading" ? 700 : 400, lineHeight: 1.35, background: b.type === "callout" ? (b.bg ?? "#f2f6fc") : "transparent", borderRadius: b.type === "callout" ? 6 : 0, padding: b.type === "callout" ? 8 * scale : 0, overflow: "hidden" }}>
                {b.text}
              </div>
            );
            return (
              <div key={b.id} style={common} onPointerDown={(e) => onPointerDown(e, b, "move")}>
                {inner}
                {isSel && (
                  <span onPointerDown={(e) => onPointerDown(e, b, "resize")} style={{ position: "absolute", right: -5, bottom: -5, width: 11, height: 11, background: "#2E78F5", borderRadius: 2, cursor: "nwse-resize" }} />
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-center text-[11px] text-[var(--text-muted)]">Drag to move · corner handle to resize · click empty space to deselect. Footer &amp; disclaimers stay locked.</p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Block</p>
        {!selected ? (
          <p className="text-xs text-[var(--text-muted)]">Select a block to edit it, or add one from the palette.</p>
        ) : (
          <div className="space-y-2.5 rounded-lg border border-[var(--border-subtle)] bg-white p-3">
            <p className="text-[11px] font-semibold capitalize text-[var(--navy)]">{selected.type}</p>
            {(selected.type === "heading" || selected.type === "text" || selected.type === "callout") && (
              <>
                <textarea value={selected.text ?? ""} onChange={(e) => update(selected.id, { text: e.target.value })} rows={3} className="w-full rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs" />
                <div>
                  <label className="text-[10px] text-[var(--text-muted)]">Font size {selected.fontSize ?? 13}pt</label>
                  <input type="range" min={9} max={48} step={1} value={selected.fontSize ?? 13} onChange={(e) => update(selected.id, { fontSize: Number(e.target.value) })} className="w-full" />
                </div>
                <div className="flex gap-1">
                  {(["left", "center", "right"] as const).map((a) => (
                    <button key={a} type="button" onClick={() => update(selected.id, { align: a })} className={`flex-1 rounded-md px-2 py-1 text-[11px] capitalize ${(selected.align ?? "left") === a ? "bg-[var(--blue-muted)] text-[var(--blue)]" : "border border-[var(--border-subtle)]"}`}>{a}</button>
                  ))}
                </div>
              </>
            )}
            {selected.type === "image" && (
              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImageFile(f); }} className="block w-full text-[11px]" />
            )}
            {(selected.type === "heading" || selected.type === "text" || selected.type === "divider") && (
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-[var(--text-muted)]">Color</label>
                <input type="color" value={selected.color ?? "#0c2340"} onChange={(e) => update(selected.id, { color: e.target.value })} />
              </div>
            )}
            {selected.type === "callout" && (
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-[var(--text-muted)]">Background</label>
                <input type="color" value={selected.bg ?? "#f2f6fc"} onChange={(e) => update(selected.id, { bg: e.target.value })} />
              </div>
            )}
            <button type="button" onClick={removeSelected} className="w-full rounded-md border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50">Delete block</button>
          </div>
        )}
      </div>
    </div>
  );
}
