"use client";

import { useMemo, useState } from "react";

export type SalesContact = { companyId: string; profileId: string | null; name: string; email: string; company: string; phone: string };

export function SalesContactsClient({ contacts }: { contacts: SalesContact[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return contacts;
    return contacts.filter((c) => [c.name, c.company, c.email, c.phone].some((v) => v.toLowerCase().includes(s)));
  }, [q, contacts]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, email, phone…"
          style={{ flex: 1, minWidth: 200, fontSize: 12.5, padding: "8px 11px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--surface-2, #fff)", color: "var(--foreground)" }} />
        <span style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>{filtered.length} of {contacts.length}</span>
      </div>

      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 1fr 130px", padding: "8px 14px", background: "var(--muted)", fontSize: 10.5, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <div>Contact</div><div>Company</div><div>Phone</div><div></div>
        </div>
        {filtered.length === 0 ? (
          <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>No matching founder contacts.</p>
        ) : filtered.slice(0, 100).map((c) => (
          <div key={c.companyId} style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 1fr 130px", padding: "11px 14px", borderTop: "0.5px solid #eef1f5", alignItems: "center", fontSize: 12.5 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.email}</div>
            </div>
            <div style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.company}</div>
            <div style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: c.phone ? "var(--foreground)" : "var(--muted-foreground)" }}>{c.phone || "—"}</div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Convert · soon</span>
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "10px 2px 0" }}>Founder contacts from the platform. Showing first {Math.min(filtered.length, 100)}. Converting a contact into an opportunity arrives with the Opportunities tab.</p>
    </div>
  );
}
