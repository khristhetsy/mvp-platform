"use client";

import { useRef, useState, type CSSProperties } from "react";
import {
  MERGE_FIELDS,
  newBlockId,
  SOCIAL_NETWORKS,
  type BlockAlign,
  type BlockPatch,
  type SocialNetwork,
  type TemplateBlock,
} from "@/lib/marketing/template-blocks";
import {
  applyPreset,
  FONT_STACKS,
  THEME_PRESETS,
  type TemplateTheme,
} from "@/lib/marketing/template-theme";

/** Brand colours offered as one-click swatches, so hex codes aren't retyped. */
const BRAND_COLOURS = ["#0c2340", "#2E78F5", "#5B4BE0", "#0F6E56", "#F1EFE8"] as const;

/** Named size steps, so you pick a role instead of guessing pixels. */
const SIZE_PRESETS = [
  { label: "Caption", px: 12 },
  { label: "Body", px: 15 },
  { label: "Subhead", px: 18 },
  { label: "Heading", px: 24 },
  { label: "Title", px: 32 },
  { label: "Display", px: 44 },
] as const;

/** Highlight swatches (first entry clears it). Kept soft so text stays legible. */
const HIGHLIGHT_COLOURS = ["#FDF3C7", "#D8ECFF", "#E7F8ED", "#FBE4EC", "#EDE9FE"] as const;

/** Preview-only CSS mirroring the email renderer's text decoration fields. */
function decorStyle(b: {
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  transform?: "upper" | "capitalize";
  tracking?: number;
  url?: string;
}): CSSProperties {
  const deco = [b.underline && "underline", b.strike && "line-through", b.url && "underline"].filter(Boolean);
  return {
    fontStyle: b.italic ? "italic" : undefined,
    textDecoration: deco.length ? deco.join(" ") : undefined,
    textTransform: b.transform === "upper" ? "uppercase" : b.transform === "capitalize" ? "capitalize" : undefined,
    letterSpacing: b.tracking ? `${b.tracking}px` : undefined,
  };
}

/** Sizes the renderer falls back to, so the number field shows the real value. */
const DEFAULT_SIZE: Partial<Record<TemplateBlock["type"], number>> = {
  heading: 24,
  text: 15,
  callout: 15,
  list: 15,
  columns: 13,
  stats: 24,
};

/**
 * Scoped visual (block) editor: you click blocks on the rendered email and edit
 * them in place. The email HTML is regenerated from these blocks on save, so the
 * editor can never emit markup that breaks in a mail client.
 */
export function TemplateVisualEditor({
  blocks,
  onChange,
  theme,
  onThemeChange,
}: Readonly<{
  blocks: TemplateBlock[];
  onChange: (next: TemplateBlock[]) => void;
  theme: TemplateTheme;
  onThemeChange: (next: TemplateTheme) => void;
}>) {
  const [selectedId, setSelectedId] = useState<string | null>(blocks[0]?.id ?? null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  function update(id: string, patch: BlockPatch) {
    onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as TemplateBlock) : b)));
  }
  function remove(id: string) {
    onChange(blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  }
  function move(id: string, dir: -1 | 1) {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function add(type: TemplateBlock["type"]) {
    const base = { id: newBlockId() };
    const block: TemplateBlock =
      type === "heading"
        ? { ...base, type: "heading", text: "New heading", level: 1, align: "left" }
        : type === "button"
        ? { ...base, type: "button", label: "Click here", url: "https://icapos.com", align: "left" }
        : type === "image"
        ? { ...base, type: "image", src: "", alt: "", width: 200, align: "center" }
        : type === "divider"
        ? { ...base, type: "divider" }
        : type === "spacer"
        ? { ...base, type: "spacer", height: 20 }
        : type === "section"
        ? { ...base, type: "section", eyebrow: "Eyebrow", heading: "Band heading", bg: "#0c2340", color: "#ffffff", align: "left" }
        : type === "callout"
        ? { ...base, type: "callout", text: "Something worth pulling out." }
        : type === "list"
        ? { ...base, type: "list", items: ["First item", "Second item"] }
        : type === "columns"
        ? { ...base, type: "columns", cells: [{ title: "For founders", text: "Know where you stand" }, { title: "For investors", text: "See who's ready" }] }
        : type === "stats"
        ? { ...base, type: "stats", items: [{ value: "78", label: "Readiness" }, { value: "14", label: "Matched" }] }
        : type === "quote"
        ? { ...base, type: "quote", text: "The readiness score told us exactly what to fix.", attribution: "Founder, Series A" }
        : type === "profile"
        ? { ...base, type: "profile", name: "Jane Doe", role: "Founder, Acme", blurb: "" }
        : type === "video"
        ? { ...base, type: "video", thumbnail: "", url: "https://icapos.com", caption: "Watch the walkthrough" }
        : type === "social"
        ? { ...base, type: "social", links: [{ network: "linkedin", url: "https://linkedin.com/company/icapos" }] }
        : type === "signature"
        ? { ...base, type: "signature", name: "{{sender_name}}", title: "", company: "iCFO Capital Global, Inc.", email: "", phone: "" }
        : { ...base, type: "text", text: "New paragraph", align: "left" };
    onChange([...blocks, block]);
    setSelectedId(block.id);
  }

  /**
   * Upload an image and point the selected image block at the returned public
   * URL. Uploads go to a public bucket because mail clients fetch images with no
   * session — a signed URL would break for every recipient.
   */
  async function uploadImage(file: File): Promise<string | null> {
    if (!/^image\//.test(file.type)) {
      setUploadError("That file isn't an image.");
      return null;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/marketing/assets/upload", { method: "POST", body });
      const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !json?.url) {
        const raw = json?.error ?? "Upload failed.";
        // "Bucket not found" means migration 20260720003 hasn't been applied —
        // say so plainly instead of leaking the storage error.
        setUploadError(
          /bucket not found/i.test(raw)
            ? "Image storage isn't set up yet — run migration 20260720003. You can paste a hosted image URL below in the meantime."
            : raw,
        );
        return null;
      }
      return json.url;
    } catch {
      setUploadError("Upload failed. Check your connection and try again.");
      return null;
    } finally {
      setUploading(false);
    }
  }

  /** Upload into an existing block. */
  async function uploadInto(file: File, blockId: string) {
    const url = await uploadImage(file);
    if (url) update(blockId, { src: url });
  }

  /** Append a new image block and upload into it (drag-and-drop onto the canvas). */
  async function uploadAsNewBlock(file: File) {
    const block: TemplateBlock = { id: newBlockId(), type: "image", src: "", alt: "", width: 200, align: "center" };
    const withPlaceholder = [...blocks, block];
    onChange(withPlaceholder);
    setSelectedId(block.id);
    const url = await uploadImage(file);
    // Apply against the list we just built — `blocks` in this closure is stale.
    onChange(
      url
        ? withPlaceholder.map((b) => (b.id === block.id ? { ...b, src: url } : b))
        : withPlaceholder.filter((b) => b.id !== block.id),
    );
  }

  /** Insert a merge field into the selected text/heading block. */
  function insertMergeField(token: string) {
    if (!selected) return;
    if (selected.type === "heading" || selected.type === "text") {
      update(selected.id, { text: `${selected.text}${selected.text.endsWith(" ") ? "" : " "}${token}` });
    } else if (selected.type === "button") {
      update(selected.id, { label: `${selected.label} ${token}` });
    }
  }

  /**
   * Templates often put light text on a dark band. The editor canvas is white,
   * so that text would be invisible — give those blocks a dark backdrop while
   * editing. Purely a canvas affordance; the saved HTML is unaffected.
   */
  function isLightText(color?: string): boolean {
    if (!color) return false;
    const hex = color.trim().replace(/^#/, "");
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    if (!/^[0-9a-f]{6}$/i.test(full)) return /^white$/i.test(color.trim());
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
    return (r * 299 + g * 587 + b * 114) / 1000 > 186;
  }

  const wrapSel = (id: string) =>
    `relative rounded-md outline-offset-2 transition ${
      selectedId === id ? "outline outline-2 outline-[#2E78F5]" : "outline outline-1 outline-transparent hover:outline-dashed hover:outline-[#9ec5ff]"
    }`;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
      {/* Canvas — the rendered email */}
      <div
        className={`rounded-xl p-5 transition ${dragOverId === "canvas" ? "outline-dashed outline-2 outline-[#2E78F5]" : ""}`}
        style={{ background: dragOverId === "canvas" ? "#dbe8ff" : theme.pageBg, fontFamily: theme.fontFamily }}
        onDragOver={(e) => { e.preventDefault(); setDragOverId((cur) => cur ?? "canvas"); }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOverId(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          const wasOverBlock = dragOverId !== "canvas" && dragOverId !== null;
          setDragOverId(null);
          if (wasOverBlock) return; // an image block already handled it
          const f = e.dataTransfer.files?.[0];
          if (f) void uploadAsNewBlock(f);
        }}
      >
        <div
          className="mx-auto overflow-hidden rounded-[10px] shadow-sm"
          style={{ maxWidth: theme.contentWidth, background: theme.cardBg }}
        >
          {blocks.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-400">No blocks yet — add one from the panel.</p>
          ) : null}

          {blocks.map((b) => (
            <div
              key={b.id}
              className={`${wrapSel(b.id)} px-1`}
              style={
                (b.type === "heading" || b.type === "text") && isLightText(b.color)
                  ? { background: "#0c2340" }
                  : undefined
              }
              onClick={() => setSelectedId(b.id)}
            >
              {selectedId === b.id ? (
                <span className="absolute -top-2 left-2 z-10 rounded-full bg-[#2E78F5] px-2 text-[9px] font-bold uppercase tracking-wide text-white">
                  {b.type}
                </span>
              ) : null}

              {b.type === "heading" ? (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onFocus={(e) => { lastFocused.current = e.currentTarget; }}
                  onBlur={(e) => update(b.id, { text: e.currentTarget.textContent ?? "" })}
                  className="px-6 py-2 font-bold outline-none"
                  style={{
                    fontSize: b.size ?? (b.level === 1 ? 24 : 19),
                    color: b.color ?? "#0c2340",
                    textAlign: b.align ?? "left",
                    ...decorStyle(b),
                  }}
                >
                  {b.highlight ? <span style={{ background: b.highlight, padding: "0 3px" }}>{b.text}</span> : b.text}
                </div>
              ) : b.type === "text" ? (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onFocus={(e) => { lastFocused.current = e.currentTarget; }}
                  onBlur={(e) => update(b.id, { text: e.currentTarget.textContent ?? "" })}
                  className="px-6 py-2 outline-none"
                  style={{
                    fontSize: b.size ?? 15,
                    fontWeight: b.bold ? 700 : 400,
                    lineHeight: b.leading ?? 1.6,
                    color: b.url ? "#2E78F5" : b.color ?? "#3a4a63",
                    textAlign: b.align ?? "left",
                    ...decorStyle(b),
                  }}
                >
                  {b.highlight ? <span style={{ background: b.highlight, padding: "0 3px" }}>{b.text}</span> : b.text}
                </div>
              ) : b.type === "button" ? (
                <div className="px-6 py-3" style={{ textAlign: b.align ?? "left" }}>
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => update(b.id, { label: e.currentTarget.textContent ?? "" })}
                    className="inline-block rounded-lg px-5 py-3 text-[15px] font-bold text-white outline-none"
                    style={{ background: b.bg ?? "#2E78F5" }}
                  >
                    {b.label}
                  </span>
                </div>
              ) : b.type === "image" ? (
                <div
                  className="px-6 py-3"
                  style={{ textAlign: b.align ?? "center" }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverId(b.id); }}
                  onDragLeave={() => setDragOverId((cur) => (cur === b.id ? null : cur))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverId(null);
                    setSelectedId(b.id);
                    const f = e.dataTransfer.files?.[0];
                    if (f) void uploadInto(f, b.id);
                  }}
                >
                  {b.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.src}
                      alt={b.alt ?? ""}
                      width={b.width ?? 200}
                      className={`inline-block h-auto max-w-full rounded ${dragOverId === b.id ? "opacity-50 outline-dashed outline-2 outline-[#2E78F5]" : ""}`}
                    />
                  ) : (
                    <span
                      className={`inline-block rounded-md border-2 border-dashed px-6 py-5 text-[11.5px] ${
                        dragOverId === b.id
                          ? "border-[#2E78F5] bg-[#eef4ff] text-[#2E78F5]"
                          : "border-slate-300 bg-slate-50 text-slate-400"
                      }`}
                    >
                      {uploading && selectedId === b.id
                        ? "Uploading…"
                        : dragOverId === b.id
                        ? "Drop to upload"
                        : "Drag an image here, or select this block and upload one."}
                    </span>
                  )}
                </div>
              ) : b.type === "divider" ? (
                <div className="px-6 py-3"><div className="border-t border-slate-200" /></div>
              ) : b.type === "section" ? (
                <div className="px-6 py-4" style={{ background: b.bg ?? "#0c2340", textAlign: b.align ?? "left" }}>
                  {b.eyebrow ? (
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => update(b.id, { eyebrow: e.currentTarget.textContent ?? "" })}
                      className="text-[12.5px] outline-none"
                      style={{ color: "#9fb3d1" }}
                    >
                      {b.eyebrow}
                    </div>
                  ) : null}
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => update(b.id, { heading: e.currentTarget.textContent ?? "" })}
                    className="font-bold outline-none"
                    style={{ fontSize: b.headingSize ?? 23, color: b.color ?? "#ffffff" }}
                  >
                    {b.heading}
                  </div>
                  {b.text ? (
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => update(b.id, { text: e.currentTarget.textContent ?? "" })}
                      className="mt-1 text-[14px] outline-none"
                      style={{ color: "#9fb3d1" }}
                    >
                      {b.text}
                    </div>
                  ) : null}
                </div>
              ) : b.type === "callout" ? (
                <div className="px-6 py-2">
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => update(b.id, { text: e.currentTarget.textContent ?? "" })}
                    className="px-3 py-2.5 outline-none"
                    style={{
                      fontSize: b.size ?? 15,
                      background: b.bg ?? "#eef4ff",
                      borderLeft: `3px solid ${b.borderColor ?? "#2E78F5"}`,
                      color: b.color ?? "#1d4ed8",
                    }}
                  >
                    {b.text}
                  </div>
                </div>
              ) : b.type === "list" ? (
                <div className="px-6 py-2">
                  {b.ordered ? (
                    <ol className="list-decimal pl-5 leading-[1.9]" style={{ fontSize: b.size ?? 15, color: b.color ?? "#3a4a63" }}>
                      {b.items.map((it, i) => <li key={`${b.id}-${i}`}>{it}</li>)}
                    </ol>
                  ) : (
                    <ul className="list-disc pl-5 leading-[1.9]" style={{ fontSize: b.size ?? 15, color: b.color ?? "#3a4a63" }}>
                      {b.items.map((it, i) => <li key={`${b.id}-${i}`}>{it}</li>)}
                    </ul>
                  )}
                </div>
              ) : b.type === "columns" ? (
                <div className="grid gap-2 px-6 py-2" style={{ gridTemplateColumns: `repeat(${Math.max(b.cells.length, 1)}, minmax(0,1fr))` }}>
                  {b.cells.map((c, i) => (
                    <div key={`${b.id}-${i}`} className="rounded-lg p-2.5" style={{ background: b.bg ?? "#f4f6fa" }}>
                      <div className="font-semibold text-slate-800" style={{ fontSize: (b.size ?? 13) + 1, color: c.url ? "#2E78F5" : undefined }}>{c.title}</div>
                      <div className="text-slate-500" style={{ fontSize: b.size ?? 13 }}>{c.text}</div>
                    </div>
                  ))}
                </div>
              ) : b.type === "quote" ? (
                <div className="px-6 py-3">
                  <div className="border-l-[3px] border-slate-300 pl-4">
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => update(b.id, { text: e.currentTarget.textContent ?? "" })}
                      className="italic outline-none"
                      style={{ fontSize: b.size ?? 18, color: b.color ?? "#1c2434" }}
                    >
                      {b.text}
                    </div>
                    {b.attribution ? (
                      <div className="pt-1.5 text-[12.5px] text-slate-500">— {b.attribution}</div>
                    ) : null}
                  </div>
                </div>
              ) : b.type === "profile" ? (
                <div className="flex gap-3 px-6 py-3">
                  {b.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.avatar} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] text-slate-400">
                      {b.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-slate-800" style={{ fontSize: (b.size ?? 15) + 1, color: b.url ? "#2E78F5" : undefined }}>{b.name}</div>
                    {b.role ? <div className="text-slate-500" style={{ fontSize: (b.size ?? 15) - 2 }}>{b.role}</div> : null}
                    {b.blurb ? <div className="pt-1 text-slate-600" style={{ fontSize: (b.size ?? 15) - 1 }}>{b.blurb}</div> : null}
                  </div>
                </div>
              ) : b.type === "video" ? (
                <div className="px-6 py-3 text-center">
                  {b.thumbnail ? (
                    <span className="relative inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.thumbnail} alt="" width={b.width ?? 480} className="inline-block h-auto max-w-full rounded-lg" />
                      <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-[15px] text-white">
                        ▶
                      </span>
                    </span>
                  ) : (
                    <span className="inline-block rounded-md border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-5 text-[11.5px] text-slate-400">
                      Add a thumbnail image — video plays after the click, not in the email.
                    </span>
                  )}
                  {b.caption ? <div className="pt-1.5 text-[12px] text-slate-500">{b.caption}</div> : null}
                </div>
              ) : b.type === "social" ? (
                <div className="px-6 py-3 text-center text-[13px]">
                  {b.links.map((l, i) => (
                    <span key={`${b.id}-s-${i}`}>
                      {i > 0 ? <span className="px-1.5 text-slate-300">·</span> : null}
                      <span style={{ color: b.color ?? "#2E78F5" }}>{l.network}</span>
                    </span>
                  ))}
                </div>
              ) : b.type === "signature" ? (
                <div className="flex gap-3 px-6 py-3">
                  {b.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.avatar} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                  ) : null}
                  <div style={{ fontSize: b.size ?? 14 }}>
                    <div className="font-bold text-slate-800">{b.name}</div>
                    {b.title ? <div className="text-slate-500">{b.title}</div> : null}
                    {b.company ? <div className="text-slate-500">{b.company}</div> : null}
                    {b.email ? <div className="text-[#2E78F5]">{b.email}</div> : null}
                    {b.phone ? <div className="text-slate-500">{b.phone}</div> : null}
                  </div>
                </div>
              ) : b.type === "stats" ? (
                <div className="grid gap-2 px-6 py-3" style={{ gridTemplateColumns: `repeat(${Math.max(b.items.length, 1)}, minmax(0,1fr))` }}>
                  {b.items.map((it, i) => (
                    <div key={`${b.id}-${i}`} className="text-center">
                      <div className="font-bold leading-tight" style={{ fontSize: b.size ?? 22, color: b.color ?? "#0c2340" }}>{it.value}</div>
                      <div className="text-[11.5px] text-slate-500">{it.label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ height: b.height ?? 20 }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Properties rail */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Theme preset</p>
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onThemeChange(p.theme);
                onChange(applyPreset(p, blocks));
              }}
              className="rounded-md border border-slate-200 p-1.5 text-left hover:bg-slate-50"
            >
              <span className="block h-2 rounded-t" style={{ background: p.swatch[0] }} />
              <span className="mb-1 block h-4 rounded-b" style={{ background: p.swatch[1] }} />
              <span className="text-[10.5px] text-slate-600">{p.label}</span>
            </button>
          ))}
        </div>
        <p className="mb-2 text-[10.5px] text-slate-400">Presets recolour existing bands and buttons.</p>

        <details className="mb-3 rounded-md border border-slate-200 p-2">
          <summary className="cursor-pointer text-[11px] font-semibold text-slate-600">Template styles</summary>
          <div className="mt-2 grid gap-2.5">
            <label className="block text-[11px] font-semibold text-slate-600">
              Font family
              <select
                value={theme.fontFamily}
                onChange={(e) => onThemeChange({ ...theme, fontFamily: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
              >
                {FONT_STACKS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <span className="mt-1 block text-[10.5px] font-normal text-slate-400">
                Only email-safe stacks — web fonts don&apos;t load reliably in mail clients.
              </span>
            </label>
            <label className="block text-[11px] font-semibold text-slate-600">
              Content width
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  type="range"
                  min={480}
                  max={700}
                  step={10}
                  value={theme.contentWidth}
                  onChange={(e) => onThemeChange({ ...theme, contentWidth: Number(e.target.value) })}
                  className="w-full"
                />
                <span className="w-9 text-[11px] text-slate-500">{theme.contentWidth}</span>
              </div>
            </label>
            <label className="block text-[11px] font-semibold text-slate-600">
              Page background
              <input
                type="color"
                value={theme.pageBg}
                onChange={(e) => onThemeChange({ ...theme, pageBg: e.target.value })}
                className="mt-1 h-8 w-full rounded-md border border-slate-200"
              />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600">
              Link colour
              <input
                type="color"
                value={theme.linkColor}
                onChange={(e) => onThemeChange({ ...theme, linkColor: e.target.value })}
                className="mt-1 h-8 w-full rounded-md border border-slate-200"
              />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600">
              Base line height
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  type="range"
                  min={1}
                  max={2.4}
                  step={0.1}
                  value={theme.baseLeading}
                  onChange={(e) => onThemeChange({ ...theme, baseLeading: Number(e.target.value) })}
                  className="w-full"
                />
                <span className="w-9 text-[11px] text-slate-500">{theme.baseLeading.toFixed(1)}</span>
              </div>
            </label>
          </div>
        </details>

        <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Add block</p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {(["heading", "text", "button", "image", "divider", "spacer"] as const).map((t) => (
            <button key={t} type="button" onClick={() => add(t)} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] capitalize text-slate-600 hover:bg-slate-50">
              + {t}
            </button>
          ))}
          {(["section", "callout", "list", "columns", "stats", "quote", "profile", "video", "social", "signature"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => add(t)}
              className="rounded-md border border-[#bcd3fb] bg-[#f2f7ff] px-2 py-1 text-[11px] font-semibold capitalize text-[#2E78F5] hover:bg-[#e6f0ff]"
            >
              + {t}
            </button>
          ))}
        </div>

        <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Selected block</p>
        {!selected ? (
          <p className="text-[11.5px] text-slate-400">Click a block on the email to edit it.</p>
        ) : (
          <div className="grid gap-2.5">
            <div className="flex gap-1.5">
              <button type="button" onClick={() => move(selected.id, -1)} className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50">↑ Up</button>
              <button type="button" onClick={() => move(selected.id, 1)} className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50">↓ Down</button>
              <button type="button" onClick={() => remove(selected.id)} className="rounded-md border border-rose-200 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50">Delete</button>
            </div>

            {"align" in selected ? (
              <label className="block text-[11px] font-semibold text-slate-600">
                Align
                <select
                  value={selected.align ?? "left"}
                  onChange={(e) => update(selected.id, { align: e.target.value as BlockAlign })}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                >
                  <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                </select>
              </label>
            ) : null}

            {selected.type === "heading" ? (
              <label className="block text-[11px] font-semibold text-slate-600">
                Level
                <select
                  value={selected.level}
                  onChange={(e) => update(selected.id, { level: Number(e.target.value) === 2 ? 2 : 1 })}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                >
                  <option value={1}>H1</option><option value={2}>H2</option>
                </select>
              </label>
            ) : null}

            {"size" in selected || selected.type === "section" ? (
              (() => {
                const currentSize =
                  selected.type === "section"
                    ? selected.headingSize ?? 24
                    : selected.size ?? DEFAULT_SIZE[selected.type] ?? 15;
                const setSize = (n: number) =>
                  update(selected.id, selected.type === "section" ? { headingSize: n } : { size: n });
                return (
                  <label className="block text-[11px] font-semibold text-slate-600">
                    {selected.type === "section" ? "Heading size" : selected.type === "stats" ? "Number size" : "Text size"}
                    {selected.type === "heading" || selected.type === "text" || selected.type === "section" ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {SIZE_PRESETS.map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => setSize(p.px)}
                            className={`rounded-md border px-1.5 py-1 text-[10.5px] font-semibold ${
                              currentSize === p.px
                                ? "border-[#2E78F5] bg-[#eef4ff] text-[#2E78F5]"
                                : "border-slate-200 text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="number"
                        min={10}
                        max={72}
                        value={currentSize}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isNaN(n)) return;
                          setSize(n);
                        }}
                        className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                      />
                      <span className="text-[11px] text-slate-400">px</span>
                    </div>
                    <span className="mt-1 block text-[10.5px] font-normal text-slate-400">Presets, or any value from 10 to 72.</span>
                  </label>
                );
              })()
            ) : null}

            {selected.type === "text" ? (
              <>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Weight
                  <select
                    value={selected.bold ? "bold" : "regular"}
                    onChange={(e) => update(selected.id, { bold: e.target.value === "bold" })}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                  >
                    <option value="regular">Regular</option>
                    <option value="bold">Bold</option>
                  </select>
                </label>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Line height
                  <input
                    type="number"
                    step={0.1}
                    min={1}
                    max={2.4}
                    value={selected.leading ?? 1.6}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isNaN(n)) update(selected.id, { leading: n });
                    }}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                  />
                </label>
              </>
            ) : null}

            {selected.type === "heading" || selected.type === "text" ? (
              <div className="space-y-2">
                <div>
                  <p className="text-[11px] font-semibold text-slate-600">Style</p>
                  <div className="mt-1 flex gap-1.5">
                    {([
                      { key: "italic", label: "I", cls: "italic" },
                      { key: "underline", label: "U", cls: "underline" },
                      { key: "strike", label: "S", cls: "line-through" },
                    ] as const).map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => update(selected.id, { [s.key]: !selected[s.key] })}
                        className={`flex-1 rounded-md border py-1.5 text-[12px] ${s.cls} ${
                          selected[s.key]
                            ? "border-[#2E78F5] bg-[#eef4ff] text-[#2E78F5]"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-slate-600">Case</p>
                  <div className="mt-1 flex gap-1.5">
                    {([
                      { val: undefined, label: "Aa" },
                      { val: "upper", label: "AA" },
                      { val: "capitalize", label: "Ab" },
                    ] as const).map((c) => (
                      <button
                        key={c.label}
                        type="button"
                        onClick={() => update(selected.id, { transform: c.val })}
                        className={`flex-1 rounded-md border py-1.5 text-[12px] font-semibold ${
                          (selected.transform ?? undefined) === c.val
                            ? "border-[#2E78F5] bg-[#eef4ff] text-[#2E78F5]"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-slate-600">Letter spacing</p>
                    <span className="text-[10.5px] text-slate-400">{selected.tracking ?? 0}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={12}
                    step={0.5}
                    value={selected.tracking ?? 0}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      update(selected.id, { tracking: n > 0 ? n : undefined });
                    }}
                    className="mt-1 w-full"
                  />
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-slate-600">Highlight</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => update(selected.id, { highlight: undefined })}
                      title="No highlight"
                      className={`flex h-6 w-6 items-center justify-center rounded border text-[11px] text-slate-400 ${
                        !selected.highlight ? "border-[#2E78F5] ring-1 ring-[#2E78F5]" : "border-slate-200"
                      }`}
                    >
                      ✕
                    </button>
                    {HIGHLIGHT_COLOURS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => update(selected.id, { highlight: c })}
                        title={c}
                        className={`h-6 w-6 rounded border ${
                          selected.highlight === c ? "border-[#2E78F5] ring-1 ring-[#2E78F5]" : "border-slate-200"
                        }`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {selected.type === "heading" || selected.type === "text" || selected.type === "section" ? (
              <label className="block text-[11px] font-semibold text-slate-600">
                {selected.type === "section" ? "Band link" : "Link URL"}{" "}
                <span className="font-normal text-slate-400">(optional)</span>
                <input
                  value={selected.url ?? ""}
                  onChange={(e) =>
                    update(selected.id, { url: e.target.value.trim() || undefined })
                  }
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                  placeholder="https://…"
                />
                <span className="mt-1 block text-[10.5px] font-normal text-slate-400">
                  {selected.type === "section" ? "Makes the whole band clickable." : "Makes the whole block clickable."}
                </span>
              </label>
            ) : null}

            {selected.type === "heading" || selected.type === "text" ? (
              <label className="block text-[11px] font-semibold text-slate-600">
                Text colour
                <input
                  type="color"
                  value={selected.color ?? (selected.type === "heading" ? "#0c2340" : "#3a4a63")}
                  onChange={(e) => update(selected.id, { color: e.target.value })}
                  className="mt-1 h-8 w-full rounded-md border border-slate-200"
                />
              </label>
            ) : null}

            {selected.type === "button" ? (
              <>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Button colour
                  <input
                    type="color"
                    value={selected.bg ?? "#2E78F5"}
                    onChange={(e) => update(selected.id, { bg: e.target.value })}
                    className="mt-1 h-8 w-full rounded-md border border-slate-200"
                  />
                </label>
              </>
            ) : null}

            {selected.type === "button" ? (
              <label className="block text-[11px] font-semibold text-slate-600">
                Link URL
                <input
                  value={selected.url}
                  onChange={(e) => update(selected.id, { url: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                  placeholder="https://…"
                />
              </label>
            ) : null}

            {selected.type === "section" ? (
              <>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Background
                  <input
                    type="color"
                    value={selected.bg ?? "#0c2340"}
                    onChange={(e) => update(selected.id, { bg: e.target.value })}
                    className="mt-1 h-8 w-full rounded-md border border-slate-200"
                  />
                </label>
                <div>
                  <p className="text-[11px] font-semibold text-slate-600">Brand palette</p>
                  <div className="mt-1 flex gap-1.5">
                    {BRAND_COLOURS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Set background ${c}`}
                        onClick={() => update(selected.id, { bg: c })}
                        className={`h-6 w-6 rounded border ${selected.bg === c ? "outline outline-2 outline-offset-2 outline-[#2E78F5]" : "border-black/10"}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Padding (vertical / horizontal)
                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                    <input
                      type="number"
                      value={selected.padV ?? 16}
                      onChange={(e) => update(selected.id, { padV: Number(e.target.value) || 0 })}
                      className="rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                    />
                    <input
                      type="number"
                      value={selected.padH ?? 24}
                      onChange={(e) => update(selected.id, { padH: Number(e.target.value) || 0 })}
                      className="rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                    />
                  </div>
                </label>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Full-width band
                  <select
                    value={selected.fullWidth === false ? "no" : "yes"}
                    onChange={(e) => update(selected.id, { fullWidth: e.target.value === "yes" })}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No — inset</option>
                  </select>
                  <span className="mt-1 block text-[10.5px] font-normal text-slate-400">
                    Bleeds to the card edges instead of sitting inside it.
                  </span>
                </label>
              </>
            ) : null}

            {selected.type === "callout" ? (
              <>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Accent border
                  <input
                    type="color"
                    value={selected.borderColor ?? "#2E78F5"}
                    onChange={(e) => update(selected.id, { borderColor: e.target.value })}
                    className="mt-1 h-8 w-full rounded-md border border-slate-200"
                  />
                </label>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Background
                  <input
                    type="color"
                    value={selected.bg ?? "#eef4ff"}
                    onChange={(e) => update(selected.id, { bg: e.target.value })}
                    className="mt-1 h-8 w-full rounded-md border border-slate-200"
                  />
                </label>
              </>
            ) : null}

            {selected.type === "list" ? (
              <>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Items <span className="font-normal text-slate-400">(one per line)</span>
                  <textarea
                    value={selected.items.join("\n")}
                    onChange={(e) =>
                      update(selected.id, { items: e.target.value.split("\n") })
                    }
                    rows={5}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                  />
                </label>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Style
                  <select
                    value={selected.ordered ? "ordered" : "bullet"}
                    onChange={(e) => update(selected.id, { ordered: e.target.value === "ordered" })}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                  >
                    <option value="bullet">Bulleted</option>
                    <option value="ordered">Numbered</option>
                  </select>
                </label>
              </>
            ) : null}

            {selected.type === "columns" ? (
              <>
                {selected.cells.map((c, i) => (
                  <div key={`${selected.id}-cell-${i}`} className="rounded-md border border-slate-200 p-2">
                    <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Column {i + 1}</p>
                    <input
                      value={c.title ?? ""}
                      placeholder="Title"
                      onChange={(e) => {
                        const cells = selected.cells.map((x, j) => (j === i ? { ...x, title: e.target.value } : x));
                        update(selected.id, { cells });
                      }}
                      className="mb-1 w-full rounded-md border border-slate-200 px-2 py-1 text-[12px]"
                    />
                    <input
                      value={c.text ?? ""}
                      placeholder="Body"
                      onChange={(e) => {
                        const cells = selected.cells.map((x, j) => (j === i ? { ...x, text: e.target.value } : x));
                        update(selected.id, { cells });
                      }}
                      className="mb-1 w-full rounded-md border border-slate-200 px-2 py-1 text-[12px]"
                    />
                    <input
                      value={c.url ?? ""}
                      placeholder="Link URL (optional)"
                      onChange={(e) => {
                        const cells = selected.cells.map((x, j) =>
                          j === i ? { ...x, url: e.target.value.trim() || undefined } : x,
                        );
                        update(selected.id, { cells });
                      }}
                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-[12px]"
                    />
                  </div>
                ))}
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={selected.cells.length >= 3}
                    onClick={() => update(selected.id, { cells: [...selected.cells, { title: "", text: "" }] })}
                    className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    + Column
                  </button>
                  <button
                    type="button"
                    disabled={selected.cells.length <= 1}
                    onClick={() => update(selected.id, { cells: selected.cells.slice(0, -1) })}
                    className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    − Column
                  </button>
                </div>
                <p className="text-[10.5px] text-slate-400">Columns stack on narrow screens. Three is the maximum.</p>
              </>
            ) : null}

            {selected.type === "stats" ? (
              <>
                {selected.items.map((it, i) => (
                  <div key={`${selected.id}-stat-${i}`} className="grid grid-cols-2 gap-1.5">
                    <input
                      value={it.value}
                      placeholder="78"
                      onChange={(e) => {
                        const items = selected.items.map((x, j) => (j === i ? { ...x, value: e.target.value } : x));
                        update(selected.id, { items });
                      }}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[12px]"
                    />
                    <input
                      value={it.label}
                      placeholder="Readiness"
                      onChange={(e) => {
                        const items = selected.items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x));
                        update(selected.id, { items });
                      }}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[12px]"
                    />
                  </div>
                ))}
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={selected.items.length >= 4}
                    onClick={() => update(selected.id, { items: [...selected.items, { value: "", label: "" }] })}
                    className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    + Stat
                  </button>
                  <button
                    type="button"
                    disabled={selected.items.length <= 1}
                    onClick={() => update(selected.id, { items: selected.items.slice(0, -1) })}
                    className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    − Stat
                  </button>
                </div>
              </>
            ) : null}

            {selected.type === "quote" ? (
              <label className="block text-[11px] font-semibold text-slate-600">
                Attribution
                <input
                  value={selected.attribution ?? ""}
                  placeholder="Founder, Series A"
                  onChange={(e) => update(selected.id, { attribution: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                />
              </label>
            ) : null}

            {selected.type === "profile" ? (
              <>
                {([
                  ["name", "Name"],
                  ["role", "Role"],
                  ["blurb", "Blurb"],
                  ["avatar", "Avatar URL"],
                  ["url", "Link URL"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="block text-[11px] font-semibold text-slate-600">
                    {label}
                    <input
                      value={(selected as unknown as Record<string, string | undefined>)[key] ?? ""}
                      onChange={(e) => update(selected.id, { [key]: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                    />
                  </label>
                ))}
              </>
            ) : null}

            {selected.type === "video" ? (
              <>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Thumbnail URL
                  <input
                    value={selected.thumbnail}
                    onChange={(e) => update(selected.id, { thumbnail: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                  />
                </label>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Links to
                  <input
                    value={selected.url}
                    onChange={(e) => update(selected.id, { url: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                  />
                  <span className="mt-1 block text-[10.5px] font-normal text-slate-400">
                    Video can&apos;t play inside an email — this is a poster image that opens the link.
                  </span>
                </label>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Caption
                  <input
                    value={selected.caption ?? ""}
                    onChange={(e) => update(selected.id, { caption: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                  />
                </label>
              </>
            ) : null}

            {selected.type === "social" ? (
              <>
                {selected.links.map((l, i) => (
                  <div key={`${selected.id}-soc-${i}`} className="grid gap-1.5 rounded-md border border-slate-200 p-2">
                    <select
                      value={l.network}
                      onChange={(e) => {
                        const links = selected.links.map((x, j) =>
                          j === i ? { ...x, network: e.target.value as SocialNetwork } : x,
                        );
                        update(selected.id, { links });
                      }}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[12px] capitalize"
                    >
                      {SOCIAL_NETWORKS.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <input
                      value={l.url}
                      placeholder="https://…"
                      onChange={(e) => {
                        const links = selected.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x));
                        update(selected.id, { links });
                      }}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[12px]"
                    />
                  </div>
                ))}
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={selected.links.length >= 6}
                    onClick={() => update(selected.id, { links: [...selected.links, { network: "website", url: "" }] })}
                    className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    + Link
                  </button>
                  <button
                    type="button"
                    disabled={selected.links.length <= 1}
                    onClick={() => update(selected.id, { links: selected.links.slice(0, -1) })}
                    className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    − Link
                  </button>
                </div>
                <p className="text-[10.5px] text-slate-400">Rendered as text labels — hosted icons break when a CDN path rots.</p>
              </>
            ) : null}

            {selected.type === "signature" ? (
              <>
                {([
                  ["name", "Name"],
                  ["title", "Title"],
                  ["company", "Company"],
                  ["email", "Email"],
                  ["phone", "Phone"],
                  ["avatar", "Avatar URL"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="block text-[11px] font-semibold text-slate-600">
                    {label}
                    <input
                      value={(selected as unknown as Record<string, string | undefined>)[key] ?? ""}
                      onChange={(e) => update(selected.id, { [key]: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                    />
                  </label>
                ))}
              </>
            ) : null}

            {selected.type === "image" ? (
              <>
                <div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadInto(f, selected.id);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInput.current?.click()}
                    className="w-full rounded-md border border-[#bcd3fb] bg-[#f2f7ff] px-2 py-1.5 text-[11.5px] font-semibold text-[#2E78F5] hover:bg-[#e6f0ff] disabled:opacity-60"
                  >
                    {uploading ? "Uploading…" : "⬆ Upload image"}
                  </button>
                  {uploadError ? <p className="mt-1 text-[10.5px] text-rose-600">{uploadError}</p> : null}
                  <p className="mt-1 text-[10.5px] text-slate-400">JPG, PNG, WebP, or GIF · max 5MB</p>
                </div>

                <label className="block text-[11px] font-semibold text-slate-600">
                  Image URL
                  <input
                    value={selected.src}
                    onChange={(e) => update(selected.id, { src: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                    placeholder="Upload above, or paste a hosted URL"
                  />
                </label>

                <label className="block text-[11px] font-semibold text-slate-600">
                  Alt text
                  <input
                    value={selected.alt ?? ""}
                    onChange={(e) => update(selected.id, { alt: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                    placeholder="Describes the image when it can't load"
                  />
                </label>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Width (px)
                  <input
                    type="number"
                    value={selected.width ?? 200}
                    onChange={(e) => update(selected.id, { width: Number(e.target.value) || 200 })}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                  />
                </label>
              </>
            ) : null}
          </div>
        )}

        {selected ? (
          <details className="mt-3 rounded-md border border-slate-200 p-2">
            <summary className="cursor-pointer text-[11px] font-semibold text-slate-600">Block styling</summary>
            <div className="mt-2 grid gap-2.5">
              <label className="block text-[11px] font-semibold text-slate-600">
                Padding (vertical / horizontal)
                <div className="mt-1 grid grid-cols-2 gap-1.5">
                  <input
                    type="number"
                    value={selected.padV ?? ""}
                    placeholder="auto"
                    onChange={(e) =>
                      update(selected.id, {
                        padV: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    className="rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                  />
                  <input
                    type="number"
                    value={selected.padH ?? ""}
                    placeholder="auto"
                    onChange={(e) =>
                      update(selected.id, {
                        padH: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    className="rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                  />
                </div>
              </label>

              <label className="block text-[11px] font-semibold text-slate-600">
                Corner radius
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    type="range"
                    min={0}
                    max={24}
                    value={selected.radius ?? 0}
                    onChange={(e) => update(selected.id, { radius: Number(e.target.value) })}
                    className="w-full"
                  />
                  <span className="w-7 text-[11px] text-slate-500">{selected.radius ?? 0}</span>
                </div>
                <span className="mt-1 block text-[10.5px] font-normal text-slate-400">Outlook renders square corners.</span>
              </label>

              <label className="block text-[11px] font-semibold text-slate-600">
                Border
                <select
                  value={selected.border ?? "none"}
                  onChange={(e) =>
                    update(selected.id, { border: e.target.value as "none" | "full" | "left" })
                  }
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                >
                  <option value="none">None</option>
                  <option value="full">Full</option>
                  <option value="left">Left</option>
                </select>
              </label>

              <label className="block text-[11px] font-semibold text-slate-600">
                Block background
                <input
                  type="color"
                  value={selected.background ?? "#ffffff"}
                  onChange={(e) => update(selected.id, { background: e.target.value })}
                  className="mt-1 h-8 w-full rounded-md border border-slate-200"
                />
              </label>

              <label className="block text-[11px] font-semibold text-slate-600">
                Hide on mobile
                <select
                  value={selected.hideOnMobile ? "hide" : "show"}
                  onChange={(e) => update(selected.id, { hideOnMobile: e.target.value === "hide" })}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                >
                  <option value="show">Show</option>
                  <option value="hide">Hide</option>
                </select>
                <span className="mt-1 block text-[10.5px] font-normal text-slate-400">
                  Outlook desktop ignores this and shows the block anyway.
                </span>
              </label>
            </div>
          </details>
        ) : null}

        <p className="mb-2 mt-4 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Merge fields</p>
        <div className="flex flex-wrap gap-1.5">
          {MERGE_FIELDS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => insertMergeField(f)}
              className="rounded bg-[#eef4ff] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#1d4ed8] hover:bg-[#dde9ff]"
            >
              {f}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10.5px] text-slate-400">Appends to the selected text, heading, or button.</p>
      </div>
    </div>
  );
}
