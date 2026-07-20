"use client";

import { useRef, useState } from "react";
import {
  MERGE_FIELDS,
  newBlockId,
  type BlockAlign,
  type TemplateBlock,
} from "@/lib/marketing/template-blocks";

/**
 * Scoped visual (block) editor: you click blocks on the rendered email and edit
 * them in place. The email HTML is regenerated from these blocks on save, so the
 * editor can never emit markup that breaks in a mail client.
 */
export function TemplateVisualEditor({
  blocks,
  onChange,
}: Readonly<{ blocks: TemplateBlock[]; onChange: (next: TemplateBlock[]) => void }>) {
  const [selectedId, setSelectedId] = useState<string | null>(blocks[0]?.id ?? null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  function update(id: string, patch: Partial<TemplateBlock>) {
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
        : { ...base, type: "text", text: "New paragraph", align: "left" };
    onChange([...blocks, block]);
    setSelectedId(block.id);
  }

  /**
   * Upload an image and point the selected image block at the returned public
   * URL. Uploads go to a public bucket because mail clients fetch images with no
   * session — a signed URL would break for every recipient.
   */
  async function uploadImage(file: File, blockId: string) {
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/marketing/assets/upload", { method: "POST", body });
      const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !json?.url) {
        setUploadError(json?.error ?? "Upload failed.");
        return;
      }
      update(blockId, { src: json.url } as Partial<TemplateBlock>);
    } catch {
      setUploadError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  /** Insert a merge field into the selected text/heading block. */
  function insertMergeField(token: string) {
    if (!selected) return;
    if (selected.type === "heading" || selected.type === "text") {
      update(selected.id, { text: `${selected.text}${selected.text.endsWith(" ") ? "" : " "}${token}` } as Partial<TemplateBlock>);
    } else if (selected.type === "button") {
      update(selected.id, { label: `${selected.label} ${token}` } as Partial<TemplateBlock>);
    }
  }

  const wrapSel = (id: string) =>
    `relative rounded-md outline-offset-2 transition ${
      selectedId === id ? "outline outline-2 outline-[#2E78F5]" : "outline outline-1 outline-transparent hover:outline-dashed hover:outline-[#9ec5ff]"
    }`;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
      {/* Canvas — the rendered email */}
      <div className="rounded-xl bg-[#eef2f8] p-5">
        <div className="mx-auto max-w-[560px] overflow-hidden rounded-[10px] bg-white shadow-sm">
          {blocks.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-400">No blocks yet — add one from the panel.</p>
          ) : null}

          {blocks.map((b) => (
            <div key={b.id} className={`${wrapSel(b.id)} px-1`} onClick={() => setSelectedId(b.id)}>
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
                  onBlur={(e) => update(b.id, { text: e.currentTarget.textContent ?? "" } as Partial<TemplateBlock>)}
                  className="px-6 py-2 font-bold outline-none"
                  style={{ fontSize: b.level === 1 ? 24 : 19, color: b.color ?? "#0c2340", textAlign: b.align ?? "left" }}
                >
                  {b.text}
                </div>
              ) : b.type === "text" ? (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onFocus={(e) => { lastFocused.current = e.currentTarget; }}
                  onBlur={(e) => update(b.id, { text: e.currentTarget.textContent ?? "" } as Partial<TemplateBlock>)}
                  className="px-6 py-2 text-[15px] leading-relaxed outline-none"
                  style={{ color: b.color ?? "#3a4a63", textAlign: b.align ?? "left" }}
                >
                  {b.text}
                </div>
              ) : b.type === "button" ? (
                <div className="px-6 py-3" style={{ textAlign: b.align ?? "left" }}>
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => update(b.id, { label: e.currentTarget.textContent ?? "" } as Partial<TemplateBlock>)}
                    className="inline-block rounded-lg px-5 py-3 text-[15px] font-bold text-white outline-none"
                    style={{ background: b.bg ?? "#2E78F5" }}
                  >
                    {b.label}
                  </span>
                </div>
              ) : b.type === "image" ? (
                <div className="px-6 py-3" style={{ textAlign: b.align ?? "center" }}>
                  {b.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.src} alt={b.alt ?? ""} width={b.width ?? 200} className="inline-block h-auto max-w-full" />
                  ) : (
                    <span className="inline-block rounded-md border border-dashed border-slate-300 bg-slate-50 px-6 py-5 text-[11.5px] text-slate-400">
                      No image yet — select this block and upload one.
                    </span>
                  )}
                </div>
              ) : b.type === "divider" ? (
                <div className="px-6 py-3"><div className="border-t border-slate-200" /></div>
              ) : (
                <div style={{ height: b.height ?? 20 }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Properties rail */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Add block</p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {(["heading", "text", "button", "image", "divider", "spacer"] as const).map((t) => (
            <button key={t} type="button" onClick={() => add(t)} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] capitalize text-slate-600 hover:bg-slate-50">
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
                  onChange={(e) => update(selected.id, { align: e.target.value as BlockAlign } as Partial<TemplateBlock>)}
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
                  onChange={(e) => update(selected.id, { level: Number(e.target.value) === 2 ? 2 : 1 } as Partial<TemplateBlock>)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                >
                  <option value={1}>H1</option><option value={2}>H2</option>
                </select>
              </label>
            ) : null}

            {selected.type === "button" ? (
              <label className="block text-[11px] font-semibold text-slate-600">
                Link URL
                <input
                  value={selected.url}
                  onChange={(e) => update(selected.id, { url: e.target.value } as Partial<TemplateBlock>)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                  placeholder="https://…"
                />
              </label>
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
                      if (f) void uploadImage(f, selected.id);
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
                    onChange={(e) => update(selected.id, { src: e.target.value } as Partial<TemplateBlock>)}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                    placeholder="Upload above, or paste a hosted URL"
                  />
                </label>

                <label className="block text-[11px] font-semibold text-slate-600">
                  Alt text
                  <input
                    value={selected.alt ?? ""}
                    onChange={(e) => update(selected.id, { alt: e.target.value } as Partial<TemplateBlock>)}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                    placeholder="Describes the image when it can't load"
                  />
                </label>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Width (px)
                  <input
                    type="number"
                    value={selected.width ?? 200}
                    onChange={(e) => update(selected.id, { width: Number(e.target.value) || 200 } as Partial<TemplateBlock>)}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
                  />
                </label>
              </>
            ) : null}
          </div>
        )}

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
