"use client";

// Upload a finished contract (PDF) for a contact. The document joins the
// contract list like a template document; the next step places the signature
// boxes (prospect and your countersignature) with the e-signature tool.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, btn, MUTED, NAVY, Notice } from "./ui";

type C = { id: string; name: string; email: string | null; company: string | null };
type Entity = { id: string; legal_name: string; short_name: string; active: boolean };

export function UploadContractModal({ contact: fixed, onClose }: { contact?: C; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<C[]>([]);
  const [contact, setContact] = useState<C | null>(fixed ?? null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityId, setEntityId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    void api<{ entities: Entity[] }>("/api/admin/sales/contracts/templates").then((r) => {
      if (!alive) return;
      const list = (r.data.entities ?? []).filter((e) => e.active);
      setEntities(list);
      setEntityId((cur) => cur || list[0]?.id || "");
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (contact) return;
    let alive = true;
    const t = setTimeout(() => {
      void api<{ contacts: C[] }>(`/api/admin/sales/contracts/spv-contacts?q=${encodeURIComponent(q)}`).then((r) => alive && setRows(r.data.contacts ?? []));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, contact]);

  function pick(f: File | undefined | null) {
    setError(null);
    if (!f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") {
      setError(/\.docx?$/i.test(f.name) ? "Upload the contract as a PDF. In Word: File › Save As › PDF, then upload that file." : "Upload the contract as a PDF.");
      return;
    }
    setFile(f);
  }

  async function submit() {
    if (!contact || !entityId || !file) return;
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    body.append("contactId", contact.id);
    body.append("entityId", entityId);
    const res = await fetch("/api/admin/sales/contracts/upload", { method: "POST", body });
    const data = (await res.json().catch(() => ({}))) as { error?: string; placeUrl?: string };
    if (!res.ok || !data.placeUrl) {
      setBusy(false);
      setError(data.error ?? "Upload failed.");
      return;
    }
    router.push(data.placeUrl);
  }

  const label = { fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" as const, color: MUTED, display: "block", marginBottom: 6 };
  const box = { width: "100%", boxSizing: "border-box" as const, border: "0.5px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff" };

  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(10,26,64,.35)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "10vh", zIndex: 80 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, calc(100vw - 32px))", background: "#fff", borderRadius: 12, boxShadow: "0 16px 40px rgba(10,26,64,.22)", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #eef1f5", fontSize: 15, fontWeight: 700, color: NAVY }}>Upload contract</div>
        <div style={{ padding: "16px 18px", display: "grid", gap: 14 }}>
          <div>
            <span style={label}>Send to</span>
            {contact ? (
              <div style={{ ...box, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ color: NAVY }}>
                  <b>{contact.name}</b>
                  <span style={{ color: MUTED }}>{[contact.company, contact.email].filter(Boolean).length ? ` · ${[contact.company, contact.email].filter(Boolean).join(" · ")}` : ""}</span>
                </span>
                {fixed ? null : (
                  <button type="button" onClick={() => setContact(null)} style={{ border: "none", background: "none", color: "#185FA5", fontSize: 12, cursor: "pointer" }}>Change</button>
                )}
              </div>
            ) : (
              <>
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company or email" style={box} />
                <div style={{ maxHeight: 180, overflowY: "auto", border: rows.length ? "0.5px solid #eef1f5" : "none", borderRadius: 8, marginTop: 6 }}>
                  {rows.map((c) => (
                    <button key={c.id} type="button" onClick={() => setContact(c)} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", borderTop: "0.5px solid #f2f5fa", background: "#fff", cursor: "pointer" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{c.name}</div>
                      <div style={{ fontSize: 11.5, color: MUTED }}>{[c.company, c.email].filter(Boolean).join(" · ") || "—"}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div>
            <span style={label}>Issuing entity</span>
            <select value={entityId} onChange={(e) => setEntityId(e.target.value)} style={box}>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{e.legal_name}</option>
              ))}
            </select>
          </div>
          <div>
            <span style={label}>Contract file</span>
            <div
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                pick(e.dataTransfer.files?.[0]);
              }}
              style={{ border: `1.5px dashed ${drag ? "#1A6CE4" : "#9fbbe0"}`, borderRadius: 12, background: drag ? "#eef5ff" : "#f6f9ff", padding: 18, textAlign: "center", color: "#185FA5", cursor: "pointer" }}
            >
              {file ? (
                <>
                  <b style={{ display: "block", color: NAVY, fontSize: 14 }}>{file.name}</b>
                  <span style={{ fontSize: 12 }}>{Math.max(1, Math.round(file.size / 1024))} KB · click to choose another</span>
                </>
              ) : (
                <>
                  <b style={{ display: "block", color: NAVY, fontSize: 14 }}>Drop your finished contract</b>
                  <span style={{ fontSize: 12 }}>PDF · or click to choose</span>
                </>
              )}
            </div>
            <input ref={input} type="file" accept=".pdf,application/pdf" style={{ display: "none" }} onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }} />
          </div>
          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px", borderTop: "0.5px solid #eef1f5" }}>
          <button type="button" onClick={onClose} style={btn()}>Cancel</button>
          <button type="button" disabled={busy || !contact || !entityId || !file} onClick={() => void submit()} style={{ ...btn(true), opacity: busy || !contact || !entityId || !file ? 0.5 : 1 }}>
            {busy ? "Uploading…" : "Next: place signatures"}
          </button>
        </div>
      </div>
    </div>
  );
}
