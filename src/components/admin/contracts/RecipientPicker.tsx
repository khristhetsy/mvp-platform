"use client";

// Choose who an uploaded contract goes to. Done last, after the signature boxes
// are placed: each result shows the contact's email and company, and the
// chosen contact is shown as a card before moving on to the cover email.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, btn, MUTED, NAVY, Notice } from "./ui";

type C = { id: string; name: string; email: string | null; company: string | null };

export function RecipientPicker({ docId, onClose }: { docId: string; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<C[]>([]);
  const [picked, setPicked] = useState<C | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (picked) return;
    let alive = true;
    const t = setTimeout(() => {
      void api<{ contacts: C[] }>(`/api/admin/sales/contracts/spv-contacts?q=${encodeURIComponent(q)}`).then((r) => alive && setRows(r.data.contacts ?? []));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, picked]);

  async function next() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    const r = await api<{ sendUrl: string }>(`/api/admin/sales/contracts/${docId}/recipient`, { method: "POST", body: JSON.stringify({ contactId: picked.id }) });
    if (!r.ok || !r.data.sendUrl) {
      setBusy(false);
      setError(r.data.error ?? "Could not save the recipient.");
      return;
    }
    router.push(r.data.sendUrl);
  }

  const label = { fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" as const, color: MUTED, display: "block", marginBottom: 6 };
  const box = { width: "100%", boxSizing: "border-box" as const, border: "0.5px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff" };
  const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(10,26,64,.35)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "10vh", zIndex: 80 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, calc(100vw - 32px))", background: "#fff", borderRadius: 12, boxShadow: "0 16px 40px rgba(10,26,64,.22)", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #eef1f5", fontSize: 15, fontWeight: 700, color: NAVY }}>Choose recipient</div>
        <div style={{ padding: "16px 18px", display: "grid", gap: 14 }}>
          {picked ? (
            <div>
              <span style={label}>Send to</span>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center", border: "1.5px solid #1A6CE4", background: "#f6f9ff", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#185FA5", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{initials(picked.name)}</div>
                <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: "2px 10px", fontSize: 12.5, minWidth: 0 }}>
                  <span style={{ color: MUTED }}>Name</span><b style={{ color: NAVY }}>{picked.name}</b>
                  <span style={{ color: MUTED }}>Email</span><span style={{ color: picked.email ? NAVY : "#A32D2D", overflowWrap: "anywhere" }}>{picked.email ?? "No email on file"}</span>
                  <span style={{ color: MUTED }}>Company</span><span style={{ color: NAVY }}>{picked.company ?? "—"}</span>
                </div>
                <button type="button" onClick={() => setPicked(null)} style={btn()}>Change</button>
              </div>
            </div>
          ) : (
            <div>
              <span style={label}>Send to</span>
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company or email" style={box} />
              <div style={{ maxHeight: 240, overflowY: "auto", border: rows.length ? "0.5px solid #eef1f5" : "none", borderRadius: 8, marginTop: 6 }}>
                {rows.map((c) => (
                  <button key={c.id} type="button" onClick={() => setPicked(c)} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", borderTop: "0.5px solid #f2f5fa", background: "#fff", cursor: "pointer" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{c.name}</span>
                    <span style={{ fontSize: 12, color: MUTED }}>{[c.email, c.company].filter(Boolean).length ? ` · ${[c.email, c.company].filter(Boolean).join(" · ")}` : ""}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {picked && !picked.email ? <Notice tone="warn">This contact has no email address. Add one on the contact before sending.</Notice> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px", borderTop: "0.5px solid #eef1f5" }}>
          <button type="button" onClick={onClose} style={btn()}>Back</button>
          <button type="button" disabled={busy || !picked || !picked.email} onClick={() => void next()} style={{ ...btn(true), opacity: busy || !picked || !picked.email ? 0.5 : 1 }}>
            {busy ? "Saving…" : "Next: cover email"}
          </button>
        </div>
      </div>
    </div>
  );
}
