"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EMAIL_IMAGE_LARGE_BYTES,
  EMAIL_IMAGE_MAX_BYTES,
  checkImageFile,
  formatImageSize,
  type EmailImage,
} from "@/lib/email-images";

/** Upload date in PT, the platform time zone. */
const ptDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric" });

/** Width and height read in the browser before upload, so the library can show them. */
function readSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

const field: React.CSSProperties = { fontSize: 12.5, padding: "7px 9px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", boxSizing: "border-box" };
const ghost: React.CSSProperties = { fontSize: 11.5, padding: "4px 9px", borderRadius: 7, border: "0.5px solid #cdd9ec", background: "transparent", color: "#185FA5", cursor: "pointer" };

/** The library's images; throws with the API's message when the request fails. */
async function fetchEmailImages(): Promise<EmailImage[]> {
  const r = await fetch("/api/admin/email-images", { cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? "Could not load the images.");
  return d.images ?? [];
}

/**
 * The email images library: upload by drag and drop or click, then copy a public link
 * or pick an image to insert. `library` mode manages images (copy link, edit, archive);
 * `insert` mode selects one image for the composer.
 */
export function EmailImageLibrary({ mode, selectedId, onSelect }: {
  mode: "library" | "insert";
  selectedId?: string | null;
  onSelect?: (image: EmailImage) => void;
}) {
  const [images, setImages] = useState<EmailImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAlt, setEditAlt] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch("/api/admin/email-images", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Could not load the images.");
      setImages(d.images ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load the images.");
    } finally {
      setLoading(false);
    }
  }, []);
  // First load: state starts as loading with no error, so only the result is set (in callbacks).
  useEffect(() => {
    let live = true;
    fetchEmailImages()
      .then((imgs) => { if (live) setImages(imgs); })
      .catch((e: unknown) => { if (live) setLoadError(e instanceof Error ? e.message : "Could not load the images."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  async function upload(list: FileList | File[]) {
    const files = Array.from(list);
    if (!files.length) return;
    const failed: string[] = [];
    let first: EmailImage | null = null;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setStatus(`Uploading ${i + 1} of ${files.length}: ${f.name}`);
      const check = checkImageFile(f);
      if (!check.ok) { failed.push(check.error); continue; }
      const size = await readSize(f);
      const fd = new FormData();
      fd.append("file", f);
      if (size) { fd.append("width", String(size.width)); fd.append("height", String(size.height)); }
      try {
        const r = await fetch("/api/admin/email-images", { method: "POST", body: fd });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.image) { failed.push(d.error ?? `${f.name}: the upload failed.`); continue; }
        const img = d.image as EmailImage;
        if (!first) first = img;
        setImages((cur) => [img, ...cur]);
      } catch {
        failed.push(`${f.name}: the upload failed. Check your connection and try again.`);
      }
    }
    setStatus(null);
    setErrors(failed);
    if (first && mode === "insert") onSelect?.(first);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function copyLink(img: EmailImage) {
    const ok = await copyText(img.public_url);
    setCopiedId(ok ? img.id : null);
    if (ok) setTimeout(() => setCopiedId((c) => (c === img.id ? null : c)), 1800);
    else setErrors([`Could not copy. Select the link by hand: ${img.public_url}`]);
  }

  function startEdit(img: EmailImage) {
    setEditId(img.id);
    setEditName(img.name);
    setEditAlt(img.alt_text ?? "");
    setConfirmId(null);
  }

  async function saveEdit(img: EmailImage) {
    setBusyId(img.id);
    try {
      const r = await fetch(`/api/admin/email-images/${img.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, altText: editAlt }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.image) { setErrors([d.error ?? "Could not save the changes."]); return; }
      setImages((cur) => cur.map((x) => (x.id === img.id ? (d.image as EmailImage) : x)));
      setEditId(null);
    } finally {
      setBusyId(null);
    }
  }

  async function archive(img: EmailImage) {
    setBusyId(img.id);
    try {
      const r = await fetch(`/api/admin/email-images/${img.id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErrors([d.error ?? "Could not archive the image."]); return; }
      setImages((cur) => cur.filter((x) => x.id !== img.id));
      setConfirmId(null);
    } finally {
      setBusyId(null);
    }
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? images.filter((i) => i.name.toLowerCase().includes(q)) : images;
  }, [images, query]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
          <i className="ti ti-search" aria-hidden="true" style={{ position: "absolute", left: 9, top: 9, fontSize: 14, color: "var(--muted-foreground)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search images" aria-label="Search images" style={{ ...field, width: "100%", paddingLeft: 28 }} />
        </div>
        <span style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>{images.length} image{images.length === 1 ? "" : "s"}</span>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
        style={{ border: `1.5px dashed ${dragging ? "#2E78F5" : "#b9c6dd"}`, background: dragging ? "#EEF4FE" : "var(--muted, #f6f8fc)", borderRadius: 10, padding: "14px 12px", textAlign: "center", cursor: "pointer", marginBottom: 12 }}>
        <i className="ti ti-cloud-upload" aria-hidden="true" style={{ fontSize: 18, color: "#2E78F5", verticalAlign: "-3px", marginRight: 6 }} />
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>Drag images here or click to upload</span>
        <span style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}> · JPG, PNG, WebP, GIF, {formatImageSize(EMAIL_IMAGE_MAX_BYTES)} max</span>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => { if (e.target.files) void upload(e.target.files); }} />
      </div>

      {status ? <p style={{ fontSize: 12, color: "#185FA5", margin: "0 0 8px" }}>{status}</p> : null}
      {errors.length ? (
        <div style={{ fontSize: 12, color: "#9B1C1C", background: "#FDECEC", border: "0.5px solid #F5C2C2", borderRadius: 8, padding: "8px 10px", margin: "0 0 10px" }}>
          {errors.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      ) : null}

      {loading ? <p style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>Loading images…</p>
        : loadError ? <p style={{ fontSize: 12.5, color: "#9B1C1C" }}>{loadError} <button type="button" onClick={() => void load()} style={{ ...ghost, marginLeft: 6 }}>Try again</button></p>
        : shown.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", textAlign: "center", padding: "18px 0" }}>
            {images.length === 0 ? "No images yet. Upload your first one above." : "No images match your search."}
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
            {shown.map((img) => {
              const selected = mode === "insert" && selectedId === img.id;
              const editing = editId === img.id;
              return (
                <div key={img.id}
                  onClick={mode === "insert" ? () => onSelect?.(img) : undefined}
                  style={{ border: selected ? "2px solid #2E78F5" : "0.5px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--background)", cursor: mode === "insert" ? "pointer" : "default" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- public library thumbnails, sizes unknown */}
                  <img src={img.public_url} alt={img.alt_text ?? img.name} loading="lazy" style={{ display: "block", width: "100%", height: 100, objectFit: "contain", background: "#f1f4f9" }} />
                  <div style={{ padding: "7px 9px" }}>
                    {editing ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} aria-label="Image name" style={{ ...field, width: "100%", marginBottom: 5, padding: "5px 7px", fontSize: 12 }} />
                        <input value={editAlt} onChange={(e) => setEditAlt(e.target.value)} placeholder="Default alt text" aria-label="Default alt text" style={{ ...field, width: "100%", marginBottom: 6, padding: "5px 7px", fontSize: 12 }} />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" disabled={busyId === img.id || !editName.trim()} onClick={() => void saveEdit(img)} style={{ ...ghost, background: "#2E78F5", color: "#fff", border: "none" }}>Save</button>
                          <button type="button" onClick={() => setEditId(null)} style={ghost}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div title={img.name} style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.name}</div>
                        <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 1 }}>
                          {formatImageSize(img.bytes)}{img.width && img.height ? ` · ${img.width}×${img.height}` : ""} · {ptDate(img.created_at)}
                        </div>
                        {img.bytes > EMAIL_IMAGE_LARGE_BYTES ? (
                          <div style={{ fontSize: 10.5, color: "#8A5A00", marginTop: 3 }}>Large image, may load slowly in email.</div>
                        ) : null}
                        {mode === "library" ? (
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7 }}>
                            <button type="button" onClick={() => void copyLink(img)} style={{ ...ghost, fontWeight: 600 }}>
                              <i className={`ti ${copiedId === img.id ? "ti-check" : "ti-link"}`} aria-hidden="true" /> {copiedId === img.id ? "Copied" : "Copy link"}
                            </button>
                            <button type="button" onClick={() => startEdit(img)} style={ghost}>Edit</button>
                            {confirmId === img.id ? (
                              <button type="button" disabled={busyId === img.id} onClick={() => void archive(img)} style={{ ...ghost, color: "#9B1C1C", borderColor: "#F5C2C2" }}>Confirm archive</button>
                            ) : (
                              <button type="button" onClick={() => setConfirmId(img.id)} style={{ ...ghost, color: "var(--muted-foreground)" }}>Archive</button>
                            )}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      {mode === "library" && confirmId ? (
        <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 10 }}>Archiving hides the image here. The file stays online, so emails already sent keep showing it.</p>
      ) : null}
    </div>
  );
}

/**
 * The picker opened from the email composer (Insert banner): choose or upload an image, confirm the
 * alt text, then insert it as the email's banner. `replacing` is true when the email already has one.
 */
export function EmailImagePickerModal({ onInsert, onClose, replacing = false }: {
  onInsert: (image: EmailImage, alt: string) => void;
  onClose: () => void;
  replacing?: boolean;
}) {
  const [selected, setSelected] = useState<EmailImage | null>(null);
  const [alt, setAlt] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  function pick(img: EmailImage) {
    setSelected(img);
    // Prefill from the saved alt text, or a readable guess from the file name, so Insert works at once.
    const guess = img.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    setAlt(img.alt_text?.trim() || guess);
  }

  return (
    <div onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Insert banner" style={{ background: "var(--background, #fff)", borderRadius: 12, padding: 16, width: 640, maxWidth: "100%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 48px rgba(0,0,0,.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Insert banner</p>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted-foreground)" }}>✕</button>
        </div>
        {replacing ? (
          <p style={{ fontSize: 12, color: "#0F6E56", background: "#E1F5EE", border: "0.5px solid #B8E3D2", borderRadius: 8, padding: "8px 10px", margin: "0 0 10px" }}>
            <b>Replaces your current banner.</b> The banner already in this email is swapped, not added to.
          </p>
        ) : null}
        <EmailImageLibrary mode="insert" selectedId={selected?.id ?? null} onSelect={pick} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "0.5px solid var(--border)" }}>
          <label style={{ fontSize: 11.5, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>Alt text (required)</label>
          <input value={alt} onChange={(e) => setAlt(e.target.value)} disabled={!selected} placeholder={selected ? "Describe the image for people who cannot see it" : "Select an image first"} style={{ ...field, flex: 1 }} />
          <button type="button" disabled={!selected || !alt.trim()} onClick={() => selected && onInsert(selected, alt.trim())}
            style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: !selected || !alt.trim() ? "#9aa1ab" : "#2E78F5", border: "none", borderRadius: 8, padding: "8px 16px", cursor: !selected || !alt.trim() ? "default" : "pointer" }}>
            {replacing ? "Replace banner" : "Insert banner"}
          </button>
        </div>
      </div>
    </div>
  );
}
