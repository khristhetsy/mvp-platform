"use client";

// Issuer logo for the Memorandum's Information Statement cover: upload, preview, remove.
// PNG or JPEG up to 1 MB. Without a logo the cover simply has none.

import { useCallback, useEffect, useRef, useState } from "react";
import { BLUE, btn, MUTED, NAVY, Notice } from "./ui";

export function LogoControl({ docId, readOnly }: { docId: string; readOnly: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const reload = useCallback(() => setKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    void fetch(`/api/admin/sales/contracts/${docId}/logo`).then(async (res) => {
      if (!alive) return;
      if (!res.ok) return setUrl(null);
      made = URL.createObjectURL(await res.blob());
      setUrl(made);
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [docId, key]);

  async function upload(f: File) {
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.set("file", f);
    const res = await fetch(`/api/admin/sales/contracts/${docId}/logo`, { method: "POST", body });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setError(j.error ?? "Could not upload the logo.");
    reload();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/sales/contracts/${docId}/logo`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not remove the logo.");
    reload();
  }

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", padding: "10px 16px", borderBottom: "0.5px solid #e4eaf3", background: "#fff" }}>
      <div style={{ width: 120, height: 52, border: "1px dashed #b9cbe6", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: "#f6f8fc", overflow: "hidden" }}>
        {url ? (
          // A local blob preview of the uploaded file: next/image cannot optimise it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Issuer logo" style={{ maxWidth: "100%", maxHeight: "100%" }} />
        ) : (
          <span style={{ fontSize: 10.5, color: MUTED }}>No logo</span>
        )}
      </div>
      <div style={{ flex: "1 1 240px", minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>Issuer logo</div>
        <div style={{ fontSize: 11.5, color: MUTED }}>Shown on the Information Statement cover. PNG or JPEG, up to 1 MB. Without one, the cover has no logo.</div>
      </div>
      {!readOnly ? (
        <div style={{ display: "flex", gap: 8 }}>
          <input ref={file} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
          <button type="button" disabled={busy} onClick={() => file.current?.click()} style={btn(!url)}>{busy ? "Working…" : url ? "Replace logo" : "Upload logo"}</button>
          {url ? <button type="button" disabled={busy} onClick={() => void remove()} style={{ ...btn(), color: BLUE }}>Remove</button> : null}
        </div>
      ) : null}
      {error ? <div style={{ flexBasis: "100%" }}><Notice tone="error">{error}</Notice></div> : null}
    </div>
  );
}
