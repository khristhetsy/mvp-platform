"use client";

import { useRef, useState } from "react";

const FOCALS: { key: string; label: string }[] = [
  { key: "top left", label: "↖" }, { key: "top", label: "↑" }, { key: "top right", label: "↗" },
  { key: "left", label: "←" }, { key: "center", label: "•" }, { key: "right", label: "→" },
  { key: "bottom left", label: "↙" }, { key: "bottom", label: "↓" }, { key: "bottom right", label: "↘" },
];

export function EventBannerEditor({
  eventId,
  eventTitle,
  initialUrl,
  initialOverlay,
  initialFocal,
}: {
  eventId: string;
  eventTitle: string;
  initialUrl: string | null;
  initialOverlay: number;
  initialFocal: string;
}) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [overlay, setOverlay] = useState(initialOverlay);
  const [focal, setFocal] = useState(initialFocal || "center");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/events/${eventId}/banner`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Upload failed.");
      setUrl(json.coverUrl as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function savePresentation(next: { overlay?: number; focal?: string }) {
    void fetch(`/api/admin/events/${eventId}/banner`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => {});
  }

  async function remove() {
    setBusy(true);
    try {
      await fetch(`/api/admin/events/${eventId}/banner`, { method: "DELETE" }).catch(() => {});
      setUrl(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
      <h2 className="font-semibold text-[var(--navy)]">Event banner</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Upload a cover image for the event hero. The overlay keeps the title readable; the focal point controls cropping.
      </p>

      <div
        className="relative mt-4 h-44 overflow-hidden rounded-xl"
        style={{ background: "#0c2340" }}
      >
        {url && (
          <>
            <div className="absolute inset-0" style={{ backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: focal }} aria-hidden />
            <div className="absolute inset-0" style={{ background: "#0c2340", opacity: overlay / 100 }} aria-hidden />
          </>
        )}
        <div className="relative flex h-full flex-col justify-center px-5">
          <p className="text-[11px]" style={{ color: "#5DCAA5" }}>iCFO CAPITAL · ECOSYSTEM SHOWCASE</p>
          <p className="mt-1 line-clamp-2 text-xl font-medium text-white">{eventTitle}</p>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) void upload(f); }}
        onClick={() => inputRef.current?.click()}
        className={`mt-3 cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors ${over ? "border-[var(--indigo)] bg-[var(--indigo-soft)]" : "border-[var(--border-subtle)]"}`}
      >
        <p className="text-sm text-[var(--navy)]">{busy ? "Uploading…" : "Drag & drop an image, or click to upload"}</p>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">JPG, PNG, or WebP · 1600×600 recommended · up to 5 MB</p>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
      </div>

      {url && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-[var(--text-secondary)]">Overlay darkness · {overlay}%</p>
            <input
              type="range" min={0} max={90} value={overlay}
              onChange={(e) => setOverlay(Number(e.target.value))}
              onMouseUp={() => savePresentation({ overlay })}
              onTouchEnd={() => savePresentation({ overlay })}
              className="w-full"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-[var(--text-secondary)]">Focal point</p>
            <div className="grid w-24 grid-cols-3 gap-1">
              {FOCALS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => { setFocal(f.key); savePresentation({ focal: f.key }); }}
                  className={`aspect-square rounded text-xs ${focal === f.key ? "bg-[var(--indigo)] text-white" : "border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-slate-50"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        {url && (
          <button onClick={remove} disabled={busy} className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50">
            Remove banner
          </button>
        )}
        {error && <span className="text-xs text-rose-700">{error}</span>}
      </div>
    </section>
  );
}
