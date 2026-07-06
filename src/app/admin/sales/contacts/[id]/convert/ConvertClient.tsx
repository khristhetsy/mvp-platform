"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Contact = { id: string; name: string; email: string | null; company: string | null; lead_status: string | null; source: string };
type Pipe = { id: string; name: string; stages: { id: string; name: string }[] };

const inp: React.CSSProperties = { fontSize: 12, padding: "7px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", boxSizing: "border-box", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 11, color: "var(--muted-foreground)" };

export function ConvertClient({ contact, pipelines }: { contact: Contact; pipelines: Pipe[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: `${contact.name}'s opportunity`, value: "", billing: "yearly" as "yearly" | "monthly",
    pipelineId: pipelines[0]?.id ?? "", stageId: pipelines[0]?.stages[0]?.id ?? "",
    probability: "", expectedClose: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const stages = useMemo(() => pipelines.find((p) => p.id === form.pipelineId)?.stages ?? [], [pipelines, form.pipelineId]);
  const mrr = useMemo(() => {
    const v = Number(form.value);
    if (!v) return null;
    return form.billing === "monthly" ? v : Math.round(v / 12);
  }, [form.value, form.billing]);

  async function create() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/sales/opportunities", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contact.name, email: contact.email, company: contact.company, contactCrmId: contact.id,
          valueCents: form.value ? Math.round(Number(form.value) * 100) : null, billing: form.billing,
          pipelineId: form.pipelineId || null, stageId: form.stageId || null,
          probability: form.probability ? Number(form.probability) : null, expectedClose: form.expectedClose || null,
          source: contact.source, leadStatus: contact.lead_status,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.opportunity) throw new Error(data.error ?? "Convert failed.");
      router.push(`/admin/sales/opportunities/${data.opportunity.id}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Convert failed."); setBusy(false); }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12, color: "var(--muted-foreground)" }}>
        <Link href={`/admin/sales/contacts/${contact.id}`} style={{ color: "var(--muted-foreground)", textDecoration: "none" }}>← {contact.name}</Link>
        <span>·</span><span>{contact.company ?? ""}</span>
      </div>

      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Convert to opportunity</div>

        <label style={lbl}>Opportunity name</label>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ ...inp, margin: "5px 0 11px" }} />

        <div style={{ display: "flex", gap: 8, marginBottom: 11 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Deal value</label>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>$</span>
              <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} inputMode="decimal" placeholder="50,000" style={inp} />
            </div>
          </div>
          <div style={{ width: 120 }}>
            <label style={lbl}>Billing</label>
            <select value={form.billing} onChange={(e) => setForm({ ...form, billing: e.target.value as "yearly" | "monthly" })} style={{ ...inp, marginTop: 5 }}><option value="yearly">Yearly</option><option value="monthly">Monthly</option></select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 11 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Pipeline</label>
            <select value={form.pipelineId} onChange={(e) => { const p = pipelines.find((x) => x.id === e.target.value); setForm({ ...form, pipelineId: e.target.value, stageId: p?.stages[0]?.id ?? "" }); }} style={{ ...inp, marginTop: 5 }}>{pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Stage</label>
            <select value={form.stageId} onChange={(e) => setForm({ ...form, stageId: e.target.value })} style={{ ...inp, marginTop: 5 }}>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 11 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Probability (%)</label>
            <input value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} inputMode="numeric" placeholder="90" style={{ ...inp, marginTop: 5 }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Expected close</label>
            <input type="date" value={form.expectedClose} onChange={(e) => setForm({ ...form, expectedClose: e.target.value })} style={{ ...inp, marginTop: 5 }} />
          </div>
        </div>

        <div style={{ background: "var(--muted)", borderRadius: 8, padding: "9px 11px", fontSize: 11, color: "var(--muted-foreground)", marginBottom: 14 }}>
          <i className="ti ti-info-circle" aria-hidden="true" /> Expected MRR {mrr != null ? <>auto-fills to <span style={{ fontWeight: 600, color: "var(--foreground)" }}>${mrr.toLocaleString()}/mo</span></> : "is derived from deal value"}. Contact, email, and source carry over.
        </div>

        {err && <div style={{ fontSize: 11.5, color: "#A32D2D", marginBottom: 10 }}>{err}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <Link href={`/admin/sales/contacts/${contact.id}`} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "7px 14px", textDecoration: "none" }}>Cancel</Link>
          <button onClick={create} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "7px 14px", cursor: "pointer", opacity: busy ? 0.5 : 1 }}>{busy ? "Creating…" : "Create opportunity"}</button>
        </div>
      </div>
    </div>
  );
}
