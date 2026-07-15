"use client";

import { useEffect, useState } from "react";

// Configurable default From address for new campaigns & sequences. Deliverability
// (SPF/DKIM/DMARC + Resend domain verification) is set up outside the app — this only
// controls which verified address new sends default to.
type Sender = { name: string; email: string };

export function DefaultSenderCard() {
  const [form, setForm] = useState({ default_from_name: "", default_from_email: "", default_reply_to: "" });
  const [senders, setSenders] = useState<Sender[]>([]);
  const [newSender, setNewSender] = useState<Sender>({ name: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/marketing/settings").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (alive && d) {
        setForm({ default_from_name: d.default_from_name ?? "", default_from_email: d.default_from_email ?? "", default_reply_to: d.default_reply_to ?? "" });
        setSenders(Array.isArray(d.senders) ? d.senders : []);
      }
    }).catch(() => {}).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  function addSender() {
    const email = newSender.email.trim();
    const name = newSender.name.trim() || email;
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setMsg("Enter a valid email to add a sender."); return; }
    if (senders.some((s) => s.email.toLowerCase() === email.toLowerCase())) { setMsg("That address is already in the list."); return; }
    setSenders([...senders, { name, email }]);
    setNewSender({ name: "", email: "" });
    setMsg(null);
  }
  function removeSender(email: string) { setSenders(senders.filter((s) => s.email !== email)); }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/marketing/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_from_name: form.default_from_name, default_from_email: form.default_from_email, default_reply_to: form.default_reply_to || null, senders }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Save failed.");
      setMsg("Saved. New campaigns and sequences will use these senders.");
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

          <div style={{ borderTop: "0.5px solid #eef1f5", margin: "16px 0 12px", paddingTop: 14, maxWidth: 640 }}>
            <label style={lbl}>Approved From addresses</label>
            <p style={{ fontSize: 11.5, color: "#5f5e5a", margin: "0 0 10px" }}>These appear as a dropdown when creating a campaign. Each address&rsquo;s domain must be <b>verified in Resend</b>, or sends from it will bounce.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {senders.length === 0 && <span style={{ fontSize: 12, color: "#888780" }}>No addresses yet — add one below.</span>}
              {senders.map((s) => (
                <div key={s.email} style={{ display: "flex", alignItems: "center", gap: 10, background: "#F6F8FB", border: "0.5px solid #e2e6ed", borderRadius: 8, padding: "7px 11px" }}>
                  <span style={{ fontSize: 12.5 }}><b style={{ fontWeight: 600 }}>{s.name}</b> <span style={{ color: "#5f5e5a" }}>&lt;{s.email}&gt;</span></span>
                  <button type="button" onClick={() => removeSender(s.email)} aria-label={`Remove ${s.email}`} style={{ marginLeft: "auto", fontSize: 11.5, color: "#A32D2D", background: "transparent", border: "0.5px solid #F0999522", borderRadius: 6, padding: "3px 9px", cursor: "pointer" }}>Remove</button>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr auto", gap: 8 }}>
              <input value={newSender.name} onChange={(e) => setNewSender({ ...newSender, name: e.target.value })} placeholder="From name" style={inp} />
              <input value={newSender.email} onChange={(e) => setNewSender({ ...newSender, email: e.target.value })} placeholder="info@myicfos.com" style={inp} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSender(); } }} />
              <button type="button" onClick={addSender} style={{ fontSize: 12.5, fontWeight: 600, color: "#0f2147", background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, padding: "0 14px", cursor: "pointer", whiteSpace: "nowrap" }}>+ Add</button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
            <button onClick={() => void save()} disabled={saving} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Saving…" : "Save sender settings"}</button>
            {msg && <span style={{ fontSize: 12, color: /fail|error|valid/i.test(msg) ? "#A32D2D" : "#0F6E56" }}>{msg}</span>}
          </div>
        </>
      )}
    </div>
  );
}
