"use client";

import { useEffect, useState } from "react";

// Configurable default From address for new campaigns & sequences. Deliverability
// (SPF/DKIM/DMARC + Resend domain verification) is set up outside the app — this only
// controls which verified address new sends default to.
export function DefaultSenderCard() {
  const [form, setForm] = useState({ default_from_name: "", default_from_email: "", default_reply_to: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/marketing/settings").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (alive && d) setForm({ default_from_name: d.default_from_name ?? "", default_from_email: d.default_from_email ?? "", default_reply_to: d.default_reply_to ?? "" });
    }).catch(() => {}).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/marketing/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_from_name: form.default_from_name, default_from_email: form.default_from_email, default_reply_to: form.default_reply_to || null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Save failed.");
      setMsg("Saved. New campaigns and sequences will use this sender.");
      setTimeout(() => setMsg(null), 4000);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Save failed."); } finally { setSaving(false); }
  }

  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#5f5e5a", display: "block", marginBottom: 4 };
  const inp: React.CSSProperties = { width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "0.5px solid var(--border)", boxSizing: "border-box" };

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 18, marginBottom: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: "#0f2147", margin: "0 0 2px" }}>Default sender</h2>
      <p style={{ fontSize: 12, color: "#5f5e5a", margin: "0 0 14px", maxWidth: 620 }}>
        The From name and email new campaigns and sequences start with. Use an address on a domain you&rsquo;ve <b>verified in Resend</b> (with SPF, DKIM &amp; DMARC) — otherwise sends bounce.
      </p>
      {loading ? (
        <p style={{ fontSize: 12.5, color: "#888780" }}>Loading…</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12, maxWidth: 640 }}>
            <div><label style={lbl}>From name</label><input value={form.default_from_name} onChange={(e) => setForm({ ...form, default_from_name: e.target.value })} placeholder="iCapOS" style={inp} /></div>
            <div><label style={lbl}>From email</label><input value={form.default_from_email} onChange={(e) => setForm({ ...form, default_from_email: e.target.value })} placeholder="outreach@myicfos.com" style={inp} /></div>
            <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Reply-to (optional)</label><input value={form.default_reply_to} onChange={(e) => setForm({ ...form, default_reply_to: e.target.value })} placeholder="admin@myicfos.com" style={inp} /></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
            <button onClick={() => void save()} disabled={saving} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Saving…" : "Save default sender"}</button>
            {msg && <span style={{ fontSize: 12, color: /fail|error|valid/i.test(msg) ? "#A32D2D" : "#0F6E56" }}>{msg}</span>}
          </div>
        </>
      )}
    </div>
  );
}
