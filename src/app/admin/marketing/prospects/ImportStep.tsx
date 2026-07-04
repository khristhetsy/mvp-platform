"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ImportOverview } from "@/lib/prospects/store";

const card: React.CSSProperties = { background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)" };
const srcCard: React.CSSProperties = { background: "var(--muted)", border: "0.5px solid var(--border)", borderRadius: 11, padding: 13 };

const SOON = [
  { ic: "📇", t: "Google Contacts", s: "Sync a labeled group or all contacts" },
  { ic: "🟠", t: "HubSpot", s: "Pull a list or saved view · maps lifecycle stage" },
  { ic: "🐵", t: "Mailchimp", s: "Import an audience · respects prior unsubs" },
  { ic: "💠", t: "Salesforce", s: "Report or campaign member pull" },
];

export function ImportStep({ overview }: { overview: ImportOverview }) {
  const router = useRouter();
  const [side, setSide] = useState<"founder" | "investor">("founder");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", website: "", note: "", side: "founder" as "founder" | "investor" });
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy("file"); setError(null); setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/contacts/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setMsg(`Imported ${data.inserted} new, ${data.merged} merged.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally { setBusy(null); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function importSignups() {
    setBusy("signups"); setError(null); setMsg(null);
    try {
      const res = await fetch("/api/prospects/import-signups", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setMsg(`Imported ${data.imported} signups (${data.merged} already present).`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally { setBusy(null); }
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    setBusy("manual"); setError(null); setMsg(null);
    try {
      const res = await fetch("/api/contacts/manual", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, name: form.name || null, side: form.side, company: form.company || null, website: form.website || null, note: form.note || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add.");
      setMsg(`Added ${form.name || form.email}.`);
      setForm({ name: "", email: "", phone: "", company: "", website: "", note: "", side: form.side });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add.");
    } finally { setBusy(null); }
  }

  const inputCls: React.CSSProperties = { background: "var(--muted)", border: "0.5px solid var(--border)", borderRadius: 8, color: "var(--foreground)", fontSize: 12.5, padding: "9px 11px", outline: "none", width: "100%" };
  const label: React.CSSProperties = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted-foreground)", fontWeight: 800, display: "block", marginBottom: 5 };

  return (
    <div>
      {/* Side toggle */}
      <div style={{ display: "flex", background: "var(--muted)", border: "0.5px solid var(--border)", borderRadius: 10, padding: 4, gap: 4, marginBottom: 14 }}>
        {(["founder", "investor"] as const).map((s) => (
          <button key={s} onClick={() => { setSide(s); setForm((f) => ({ ...f, side: s })); }}
            style={{ flex: 1, border: "none", borderRadius: 7, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              background: side === s ? (s === "founder" ? "#2E78F5" : "#6C3FB5") : "transparent",
              color: side === s ? "#fff" : "var(--muted-foreground)" }}>
            {s === "founder" ? "🚀 Founders" : "💼 Investors"}
          </button>
        ))}
      </div>

      {/* Basket */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--card)", border: "0.5px solid var(--border)", borderRadius: 11, padding: "11px 14px", marginBottom: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#1A6CE4" }}>{overview.total.toLocaleString()}</div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.2 }}>contacts in<br />the pipeline</div>
        <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-foreground)", textAlign: "right" }}>
          Odoo <b style={{ color: "var(--foreground)" }}>{overview.odoo.toLocaleString()}</b> · manual <b style={{ color: "var(--foreground)" }}>{overview.manual.toLocaleString()}</b> · file <b style={{ color: "var(--foreground)" }}>{overview.file.toLocaleString()}</b><br />
          <span style={{ color: "#1A6CE4" }}>{overview.founders.toLocaleString()} founders · {overview.investors.toLocaleString()} investors</span>
        </div>
      </div>

      {msg ? <p style={{ background: "#ECFDF5", border: "0.5px solid #A7F3D0", color: "#065F46", fontSize: 12.5, borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>{msg}</p> : null}
      {error ? <p style={{ background: "#FEF2F2", border: "0.5px solid #FECACA", color: "#991B1B", fontSize: 12.5, borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>{error}</p> : null}

      {/* Internal */}
      <div style={card}>
        <h3 style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>Internal <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0F6E56", background: "#E1F5EE", borderRadius: 20, padding: "3px 8px", marginLeft: 6 }}>Connected</span></h3>
        <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12 }}>Already in your stack — no new spend, no ToS risk.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ ...srcCard, borderColor: "#2E78F5", background: "#EFF6FF" }}>
            <div style={{ fontSize: 18, marginBottom: 6 }}>🗂️</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Odoo CRM</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>Founder + investor lists synced</div>
            <div style={{ fontSize: 10, color: "#1A6CE4", fontWeight: 700, marginTop: 7, textTransform: "uppercase", letterSpacing: "0.06em" }}>{overview.odoo.toLocaleString()} mirrored</div>
          </div>
          <div style={srcCard}>
            <div style={{ fontSize: 18, marginBottom: 6 }}>⚡</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>iCapOS platform</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>Founder / investor signups not yet in the pipeline</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 9 }}>
              <span style={{ fontSize: 10, color: "#1A6CE4", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{overview.signupsAvailable.toLocaleString()} available</span>
              <button onClick={importSignups} disabled={busy === "signups" || overview.signupsAvailable === 0}
                style={{ fontSize: 11, fontWeight: 700, padding: "6px 11px", borderRadius: 7, border: "none", background: "#2E78F5", color: "#fff", cursor: "pointer", opacity: busy === "signups" || overview.signupsAvailable === 0 ? 0.5 : 1 }}>
                {busy === "signups" ? "Importing…" : "Import"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Existing tools */}
      <div style={card}>
        <h3 style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>Existing contact tools <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#1A6CE4", background: "#EFF6FF", borderRadius: 20, padding: "3px 8px", marginLeft: 6 }}>Import from elsewhere</span></h3>
        <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12 }}>Each connector is a one-time OAuth link + field map — on the build path. The file upload below covers all of them today.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {SOON.map((x) => (
            <div key={x.t} style={{ ...srcCard, opacity: 0.62 }}>
              <div style={{ fontSize: 18, marginBottom: 6 }}>{x.ic}</div>
              <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>{x.t} <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", color: "var(--muted-foreground)", background: "var(--muted)", border: "0.5px solid var(--border)", borderRadius: 20, padding: "2px 7px" }}>Soon</span></div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{x.s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* File upload */}
      <div style={card}>
        <h3 style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>File upload <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0F6E56", background: "#E1F5EE", borderRadius: 20, padding: "3px 8px", marginLeft: 6 }}>Ship-now</span></h3>
        <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12 }}>Export from anywhere, import here. Columns auto-detect; duplicates flag against existing leads.</p>
        <label style={{ display: "block", border: "1.5px dashed var(--border)", borderRadius: 11, padding: 20, textAlign: "center", color: "var(--muted-foreground)", fontSize: 12, background: "var(--muted)", cursor: "pointer" }}>
          <b style={{ color: "var(--foreground)" }}>{busy === "file" ? "Importing…" : "Drop a file here"}</b> or click to browse
          <div style={{ fontSize: 10, marginTop: 5, color: "var(--muted-foreground)" }}>CSV · XLSX · vCard (.vcf) · Google / Outlook / HubSpot / Mailchimp exports</div>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.vcf,.vcard" onChange={handleFile} disabled={busy === "file"} style={{ display: "none" }} />
        </label>
      </div>

      {/* Manual add */}
      <div style={card}>
        <h3 style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>Add manually <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0F6E56", background: "#E1F5EE", borderRadius: 20, padding: "3px 8px", marginLeft: 6 }}>Ship-now</span></h3>
        <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12 }}>For the one-off — a founder from an event, an investor referral. Same verify → score → list flow as everyone else.</p>
        <form onSubmit={addManual}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label style={label}>Full name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jordan Lee" style={inputCls} /></div>
            <div>
              <label style={label}>Side</label>
              <div style={{ display: "flex", gap: 6 }}>
                {(["founder", "investor"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setForm({ ...form, side: s })}
                    style={{ flex: 1, fontSize: 11.5, fontWeight: 700, padding: 8, borderRadius: 8, cursor: "pointer",
                      border: `0.5px solid ${form.side === s ? (s === "founder" ? "#2E78F5" : "#8B5CE0") : "var(--border)"}`,
                      background: form.side === s ? (s === "founder" ? "#2E78F5" : "#6C3FB5") : "var(--muted)",
                      color: form.side === s ? "#fff" : "var(--muted-foreground)" }}>
                    {s === "founder" ? "🚀 Founder" : "💼 Investor"}
                  </button>
                ))}
              </div>
            </div>
            <div><label style={label}>Email</label><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jordan@company.com" style={inputCls} /></div>
            <div><label style={label}>Phone <span style={{ color: "var(--muted-foreground)", fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>optional</span></label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 …" style={inputCls} /></div>
            <div><label style={label}>Company</label><input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company name" style={inputCls} /></div>
            <div><label style={label}>Website <span style={{ color: "var(--muted-foreground)", fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>drives enrichment</span></label><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="company.com" style={inputCls} /></div>
            <div style={{ gridColumn: "1 / -1" }}><label style={label}>Note <span style={{ color: "var(--muted-foreground)", fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>context for the AI approach</span></label><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Met at SaaStr — mentioned raising a seed in Q4" style={inputCls} /></div>
          </div>
          <div style={{ marginTop: 10 }}>
            <button type="submit" disabled={busy === "manual" || !form.email} style={{ fontSize: 11, fontWeight: 700, padding: "8px 14px", borderRadius: 7, border: "none", background: "#2E78F5", color: "#fff", cursor: "pointer", opacity: busy === "manual" || !form.email ? 0.5 : 1 }}>
              {busy === "manual" ? "Adding…" : "＋ Add to pipeline"}
            </button>
          </div>
        </form>

        {overview.recentManual.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6 }}>Recent manual adds</p>
            {overview.recentManual.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px", borderBottom: "0.5px solid var(--border)" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: r.side === "investor" ? "#F5F3FF" : "#EFF6FF", color: r.side === "investor" ? "#6C3FB5" : "#1A6CE4", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 10, flex: "none" }}>
                  {(r.name ?? r.email ?? "?").slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name || r.email}{r.company ? ` · ${r.company}` : ""}</div>
                  <div style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>{r.side ?? "unclassified"} · {r.email}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 8 }}>
        <button onClick={() => router.push("/admin/marketing/prospects?step=verify")}
          style={{ fontSize: 12, fontWeight: 700, padding: "9px 16px", borderRadius: 8, border: "none", background: "#2E78F5", color: "#fff", cursor: "pointer" }}>
          Continue to Verify →
        </button>
      </div>
    </div>
  );
}
