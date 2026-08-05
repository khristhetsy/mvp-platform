"use client";

import { useRef, useState } from "react";

// Upload an immersive lobby background image for the event's virtual lobby.
// When set, the lobby renders this image behind the hotspots instead of the grid.
export function EventLobbyBackgroundEditor({
  eventId,
  initialUrl,
  canEdit = true,
}: {
  eventId: string;
  initialUrl: string | null;
  canEdit?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(initialUrl);
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
      const res = await fetch(`/api/admin/events/${eventId}/lobby-background`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Upload failed.");
      setUrl(json.url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await fetch(`/api/admin/events/${eventId}/lobby-background`, { method: "DELETE" }).catch(() => {});
      setUrl(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
      <h2 className="font-semibold text-[var(--navy)]">Lobby background</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        An immersive image (e.g. a 3D venue render) shown behind the lobby hotspots. Leave empty for the default grid
        lobby. Wide 16:9 images work best.
      </p>

      <div className="relative mt-4 h-44 overflow-hidden rounded-xl" style={{ background: "#0c2340" }}>
        {url ? (
          <>
            <div className="absolute inset-0" style={{ backgroundImage: `url("${url}")`, backgroundSize: "cover", backgroundPosition: "center" }} aria-hidden />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(6,14,28,.35), rgba(6,14,28,.15))" }} aria-hidden />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/70">No background — using the default grid lobby</div>
        )}
      </div>

      {canEdit && (
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) void upload(f); }}
          onClick={() => inputRef.current?.click()}
          className={`mt-3 cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors ${over ? "border-[var(--indigo)] bg-[var(--indigo-soft)]" : "border-[var(--border-subtle)]"}`}
        >
          <p className="text-sm text-[var(--navy)]">{busy ? "Uploading…" : "Drop an image here, or click to choose"}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">PNG, JPG, or WEBP · up to 8 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }}
          />
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        {canEdit && url && (
          <button onClick={remove} disabled={busy} className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50">
            Remove background
          </button>
        )}
        {error && <span className="text-xs text-rose-700">{error}</span>}
      </div>
    </section>
  );
}
