"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, btn, MUTED, NAVY } from "./ui";

type C = { id: string; name: string; email: string | null; company: string | null };

/** "New": pick a contact, then open the send flow for them. */
export function ContactPicker({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<C[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const r = await api<{ contacts: C[] }>(`/api/admin/sales/contracts/spv-contacts?q=${encodeURIComponent(q)}`);
      setRows(r.data.contacts ?? []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(10,26,64,.35)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh", zIndex: 80 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(520px, calc(100vw - 32px))", background: "#fff", borderRadius: 12, boxShadow: "0 16px 40px rgba(10,26,64,.22)", overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "0.5px solid #eef1f5" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>Send contracts to…</div>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company or email" style={{ marginTop: 10, width: "100%", boxSizing: "border-box", border: "0.5px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {loading ? <p style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Loading…</p> : null}
          {!loading && rows.length === 0 ? <p style={{ padding: 16, fontSize: 12.5, color: MUTED }}>{q ? `No contact matches "${q}".` : "No contacts found."}</p> : null}
          {rows.map((c) => (
            <button key={c.id} type="button" onClick={() => router.push(`/admin/sales/contracts/send?contact=${c.id}`)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 16px", border: "none", borderTop: "0.5px solid #f2f5fa", background: "#fff", cursor: "pointer" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{c.name}</div>
              <div style={{ fontSize: 11.5, color: MUTED }}>{[c.company, c.email].filter(Boolean).join(" · ") || "—"}</div>
            </button>
          ))}
        </div>
        <div style={{ padding: "10px 16px", borderTop: "0.5px solid #eef1f5", textAlign: "right" }}>
          <button type="button" onClick={onClose} style={btn()}>Close</button>
        </div>
      </div>
    </div>
  );
}
