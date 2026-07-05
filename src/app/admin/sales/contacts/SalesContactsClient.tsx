"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type SalesContact = { id: string; name: string; email: string; company: string; phone: string; source: string };

const SOURCE_BADGE: Record<string, { text: string; color: string; bg: string }> = {
  odoo: { text: "Odoo", color: "#5F5E5A", bg: "#F1EFE8" },
  manual: { text: "Manual", color: "#185FA5", bg: "#E6F1FB" },
};

export function SalesContactsClient() {
  const router = useRouter();
  const [converting, setConverting] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [contacts, setContacts] = useState<SalesContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", company: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/contacts${query ? `?q=${encodeURIComponent(query)}` : ""}`);
      const data = res.ok ? await res.json() : { contacts: [] };
      setContacts(data.contacts ?? []);
    } catch { setContacts([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { void load(q); }, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [q, load]);

  async function addContact() {
    if (!draft.name.trim()) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/sales/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Add failed.");
      setAdding(false); setDraft({ name: "", email: "", company: "", phone: "" });
      await load(q);
    } catch (e) { setErr(e instanceof Error ? e.message : "Add failed."); } finally { setBusy(false); }
  }

  async function convert(c: SalesContact) {
    setConverting(c.id);
    try {
      const res = await fetch("/api/sales/opportunities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: c.name, email: c.email, company: c.company }) });
      if (res.ok) router.push("/admin/sales/opportunities");
    } finally { setConverting(null); }
  }

  const inp: React.CSSProperties = { fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, email, phone…" style={{ ...inp, flex: 1, minWidth: 200 }} />
        <button onClick={() => setAdding((v) => !v)} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>+ Add contact</button>
      </div>

      {adding && (
        <div style={{ background: "#F5F9FF", border: "0.5px solid #BFDBFE", borderRadius: 10, padding: 14, marginBottom: 12, display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name *" autoFocus style={inp} />
          <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="Email" style={inp} />
          <input value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} placeholder="Company" style={inp} />
          <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="Phone" style={inp} />
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={addContact} disabled={busy || !draft.name.trim()} style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "7px 12px", cursor: "pointer", opacity: busy || !draft.name.trim() ? 0.5 : 1 }}>Save</button>
            <button onClick={() => { setAdding(false); setErr(null); }} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
          </div>
          {err && <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: "#A32D2D" }}>{err}</div>}
        </div>
      )}

      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 1fr 90px 120px", padding: "8px 14px", background: "var(--muted)", fontSize: 10.5, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <div>Contact</div><div>Company</div><div>Phone</div><div>Source</div><div></div>
        </div>
        {loading ? (
          <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>Loading…</p>
        ) : contacts.length === 0 ? (
          <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>No matching contacts.</p>
        ) : contacts.map((c) => {
          const sb = SOURCE_BADGE[c.source] ?? { text: c.source, color: "#5F5E5A", bg: "#F1EFE8" };
          return (
            <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 1fr 90px 120px", padding: "11px 14px", borderTop: "0.5px solid #eef1f5", alignItems: "center", fontSize: 12.5 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.email}</div>
              </div>
              <div style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.company || "—"}</div>
              <div style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: c.phone ? "var(--foreground)" : "var(--muted-foreground)" }}>{c.phone || "—"}</div>
              <div><span style={{ fontSize: 10, fontWeight: 600, color: sb.color, background: sb.bg, borderRadius: 10, padding: "2px 8px" }}>{sb.text}</span></div>
              <div style={{ textAlign: "right" }}>
                <button onClick={() => convert(c)} disabled={converting === c.id} style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 6, padding: "5px 11px", cursor: "pointer", opacity: converting === c.id ? 0.5 : 1 }}>{converting === c.id ? "Converting…" : "Convert →"}</button>
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "10px 2px 0" }}>Contacts sync from Odoo plus manual adds and other sources. Showing up to 100 matches. Converting a contact into an opportunity arrives with the Opportunities tab.</p>
    </div>
  );
}
