"use client";

import { useState } from "react";
import { industryOptionsFor } from "@/lib/industries";
import type { LinkedCompany } from "./ContactProfileClient";

/**
 * Editable "Company · <name> (linked record)" panel on the founder profile.
 * Read-only rows with an Edit toggle that turns every field into an input and
 * saves to the company record via PATCH /api/admin/companies/:id/basics.
 * Multi-selects are stored comma-separated (matching onboarding).
 */

const REVENUE_STAGES: { value: string; label: string }[] = [
  { value: "pre_revenue", label: "Pre-revenue" },
  { value: "early_revenue", label: "Early revenue" },
  { value: "growing", label: "Growing · $100K–$1M ARR" },
  { value: "scaling", label: "Scaling · $1M+ ARR" },
];
const INVESTOR_TYPE_OPTS = ["Individual angel", "Angel group / syndicate", "Family office", "Venture fund", "Corporate / strategic", "Other"];
const CAPITAL_TYPE_OPTS = ["Equity", "SAFE", "Convertible note", "Venture debt", "Revenue-based"];
const INVESTOR_PREF_OPTS = ["Lead investor", "Follow-on / co-invest", "Hands-on / operator", "Passive", "No preference"];
const BUSINESS_ENTITY_OPTS = ["Delaware C-Corp", "LLC", "S-Corp", "Public benefit corp", "Not yet incorporated"];
const FUNDING_STAGE_OPTS = ["Pre-seed", "Seed", "Series A", "Series B", "Growth", "Other"];
const OPERATING_STAGE_OPTS = ["Idea", "Building / MVP", "Pre-revenue", "Revenue", "Scaling"];

const splitCsv = (v: string | null): string[] => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

type Form = {
  company_name: string; industry: string; revenue_stage: string; funding_amount: string;
  website: string; country: string; state: string; use_of_funds: string;
  funding_stage: string[]; operating_stage: string[]; business_entity: string;
  annual_ebitda: string; management_team: string;
  seeking_investor_types: string[]; seeking_capital_types: string[]; active_investor_preference: string[];
  business_description: string;
};

function fromCompany(c: LinkedCompany): Form {
  return {
    company_name: c.companyName ?? "", industry: c.industry ?? "",
    revenue_stage: c.revenueStage ?? "", funding_amount: c.fundingAmount != null ? String(c.fundingAmount) : "",
    website: c.website ?? "", country: c.country ?? "", state: c.state ?? "", use_of_funds: c.useOfFunds ?? "",
    funding_stage: splitCsv(c.fundingStage), operating_stage: splitCsv(c.operatingStage), business_entity: c.businessEntity ?? "",
    annual_ebitda: c.annualEbitda ?? "", management_team: c.managementTeam ?? "",
    seeking_investor_types: splitCsv(c.seekingInvestorTypes), seeking_capital_types: splitCsv(c.seekingCapitalTypes),
    active_investor_preference: splitCsv(c.activeInvestorPreference), business_description: c.description ?? "",
  };
}

const LBL = { width: 150, flexShrink: 0, color: "var(--muted-foreground)", fontSize: 12.5 } as const;
const INPUT = "w-full rounded-md border px-2.5 py-1.5 text-[12.5px]";
const inputStyle = { borderColor: "#e2e8f0", background: "white", color: "var(--foreground)" } as const;

function Chips({ options, value, onToggle, single = false }: { options: string[]; value: string[]; onToggle: (v: string) => void; single?: boolean }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" onClick={() => onToggle(o)}
            style={{ borderRadius: 999, padding: "3px 10px", fontSize: 11.5, cursor: "pointer",
              border: on ? "1px solid #2E78F5" : "1px solid #e2e8f0", background: on ? "#EEEDFE" : "white", color: on ? "#3C3489" : "#475569" }}>
            {o}{single && on ? <> <i className="ti ti-check" aria-hidden="true" /></> : ""}
          </button>
        );
      })}
    </div>
  );
}

function ViewRow({ label, children }: { label: string; children: React.ReactNode }) {
  const empty = children == null || children === "" || (Array.isArray(children) && children.length === 0);
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "5px 0", fontSize: 12.5, borderBottom: "0.5px solid #f1f5f9" }}>
      <span style={LBL}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, color: empty ? "var(--muted-foreground)" : "var(--foreground)", wordBreak: "break-word" }}>{empty ? "—" : children}</span>
    </div>
  );
}

function EditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0", fontSize: 12.5 }}>
      <span style={{ ...LBL, paddingTop: 6 }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function CompanyLinkedRecordEditor({
  company,
  onePager,
}: {
  company: LinkedCompany;
  onePager?: { slug: string | null; published: boolean } | null;
}) {
  const [data, setData] = useState<Form>(() => fromCompany(company));
  const [form, setForm] = useState<Form>(data);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k: "funding_stage" | "operating_stage" | "seeking_investor_types" | "seeking_capital_types" | "active_investor_preference", v: string) =>
    setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));

  function startEdit() { setForm(data); setErr(null); setEditing(true); }
  function cancel() { setForm(data); setEditing(false); setErr(null); }

  async function save() {
    if (form.company_name.trim().length < 2) { setErr("Company name must be at least 2 characters."); return; }
    if (form.industry.trim().length < 2) { setErr("Industry is required."); return; }
    setSaving(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/companies/${company.id}/basics`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: form.company_name.trim(),
          industry: form.industry.trim(),
          business_description: form.business_description.trim() || null,
          revenue_stage: form.revenue_stage || null,
          funding_amount: form.funding_amount.trim() ? Number(form.funding_amount.replace(/[^0-9.]/g, "")) : null,
          website: form.website.trim() || null,
          country: form.country.trim() || null,
          state: form.state.trim() || null,
          use_of_funds: form.use_of_funds.trim() || null,
          funding_stage: form.funding_stage.join(", ") || null,
          operating_stage: form.operating_stage.join(", ") || null,
          business_entity: form.business_entity || null,
          annual_ebitda: form.annual_ebitda.trim() || null,
          management_team: form.management_team.trim() || null,
          seeking_investor_types: form.seeking_investor_types.join(", ") || null,
          seeking_capital_types: form.seeking_capital_types.join(", ") || null,
          active_investor_preference: form.active_investor_preference.join(", ") || null,
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) { setErr(body?.error ?? "Could not save."); return; }
      setData(form);
      setEditing(false);
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const stageLabel = REVENUE_STAGES.find((s) => s.value === data.revenue_stage)?.label ?? data.revenue_stage;
  const pill = (t: string) => <span style={{ fontSize: 11, background: "#EEEDFE", color: "#3C3489", borderRadius: 12, padding: "2px 9px" }}>{t}</span>;

  return (
    <div style={{ marginTop: 6 }}>
      <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "#0F6E56", margin: "0 0 5px", paddingBottom: 4, borderBottom: "0.5px solid #eef1f5", display: "flex", alignItems: "center", gap: 6 }}>
        Company{data.company_name ? ` · ${data.company_name}` : ""}
        <span style={{ fontSize: 8.5, background: "#E1F5EE", color: "#0F6E56", borderRadius: 8, padding: "1px 6px", letterSpacing: 0, textTransform: "none" }}>linked record</span>
        {!editing ? (
          <button type="button" onClick={startEdit} style={{ marginLeft: "auto", fontSize: 11, color: "#2E78F5", background: "none", border: "none", cursor: "pointer", textTransform: "none", letterSpacing: 0 }}>Edit fields</button>
        ) : null}
      </p>

      {err ? <p style={{ fontSize: 12, color: "#b91c1c", margin: "0 0 8px" }}>{err}</p> : null}

      {!editing ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 28px" }}>
          <ViewRow label="Industry">{data.industry ? pill(data.industry) : null}</ViewRow>
          <ViewRow label="Revenue stage">{data.revenue_stage ? pill(stageLabel) : null}</ViewRow>
          <ViewRow label="Funding target">{data.funding_amount ? `$${Number(data.funding_amount).toLocaleString()}` : null}</ViewRow>
          <ViewRow label="Website">{data.website ? <a href={data.website} target="_blank" rel="noopener noreferrer" style={{ color: "#185FA5", textDecoration: "none" }}>{data.website}</a> : null}</ViewRow>
          <ViewRow label="Location">{[data.state, data.country].filter(Boolean).join(", ") || null}</ViewRow>
          <ViewRow label="One-pager">{onePager?.slug ? <a href={`/f/${onePager.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: "#185FA5", textDecoration: "none" }}>/f/{onePager.slug}{onePager.published ? " · Published" : " · Draft"}</a> : null}</ViewRow>
          <ViewRow label="Funding stage">{data.funding_stage.join(", ") || null}</ViewRow>
          <ViewRow label="Operating stage">{data.operating_stage.join(", ") || null}</ViewRow>
          <ViewRow label="Business entity">{data.business_entity || null}</ViewRow>
          <ViewRow label="Annual EBITDA">{data.annual_ebitda || null}</ViewRow>
          <ViewRow label="Type of investor(s)">{data.seeking_investor_types.join(", ") || null}</ViewRow>
          <ViewRow label="Type(s) of capital">{data.seeking_capital_types.join(", ") || null}</ViewRow>
          <ViewRow label="Active investor preference">{data.active_investor_preference.join(", ") || null}</ViewRow>
          <ViewRow label="Management team">{data.management_team || null}</ViewRow>
          <div style={{ gridColumn: "1 / -1" }}><ViewRow label="Use of funds">{data.use_of_funds || null}</ViewRow></div>
          <div style={{ gridColumn: "1 / -1" }}><ViewRow label="Description">{data.business_description || null}</ViewRow></div>
        </div>
      ) : (
        <div>
          <EditRow label="Company name"><input className={INPUT} style={inputStyle} value={form.company_name} onChange={(e) => set("company_name", e.target.value)} /></EditRow>
          <EditRow label="Industry">
            <select className={INPUT} style={inputStyle} value={form.industry} onChange={(e) => set("industry", e.target.value)}>
              {!form.industry ? <option value="">— Select —</option> : null}
              {industryOptionsFor(form.industry).map((o) => (<option key={o} value={o}>{o}</option>))}
            </select>
          </EditRow>
          <EditRow label="Revenue stage">
            <select className={INPUT} style={inputStyle} value={form.revenue_stage} onChange={(e) => set("revenue_stage", e.target.value)}>
              <option value="">— Select —</option>
              {REVENUE_STAGES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
            </select>
          </EditRow>
          <EditRow label="Funding target"><input className={INPUT} style={inputStyle} value={form.funding_amount} onChange={(e) => set("funding_amount", e.target.value)} placeholder="e.g. 2300000" /></EditRow>
          <EditRow label="Website"><input className={INPUT} style={inputStyle} value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…" /></EditRow>
          <EditRow label="State / region"><input className={INPUT} style={inputStyle} value={form.state} onChange={(e) => set("state", e.target.value)} /></EditRow>
          <EditRow label="Country"><input className={INPUT} style={inputStyle} value={form.country} onChange={(e) => set("country", e.target.value)} /></EditRow>
          <EditRow label="Funding stage"><Chips options={FUNDING_STAGE_OPTS} value={form.funding_stage} onToggle={(v) => toggle("funding_stage", v)} /></EditRow>
          <EditRow label="Operating stage"><Chips options={OPERATING_STAGE_OPTS} value={form.operating_stage} onToggle={(v) => toggle("operating_stage", v)} /></EditRow>
          <EditRow label="Business entity"><Chips options={BUSINESS_ENTITY_OPTS} value={form.business_entity ? [form.business_entity] : []} onToggle={(v) => set("business_entity", form.business_entity === v ? "" : v)} single /></EditRow>
          <EditRow label="Annual EBITDA"><input className={INPUT} style={inputStyle} value={form.annual_ebitda} onChange={(e) => set("annual_ebitda", e.target.value)} placeholder="e.g. -$120,000" /></EditRow>
          <EditRow label="Type of investor(s)"><Chips options={INVESTOR_TYPE_OPTS} value={form.seeking_investor_types} onToggle={(v) => toggle("seeking_investor_types", v)} /></EditRow>
          <EditRow label="Type(s) of capital"><Chips options={CAPITAL_TYPE_OPTS} value={form.seeking_capital_types} onToggle={(v) => toggle("seeking_capital_types", v)} /></EditRow>
          <EditRow label="Active investor preference"><Chips options={INVESTOR_PREF_OPTS} value={form.active_investor_preference} onToggle={(v) => toggle("active_investor_preference", v)} /></EditRow>
          <EditRow label="Management team"><input className={INPUT} style={inputStyle} value={form.management_team} onChange={(e) => set("management_team", e.target.value)} placeholder="e.g. 2 co-founders, 3 full-time" /></EditRow>
          <EditRow label="Use of funds"><input className={INPUT} style={inputStyle} value={form.use_of_funds} onChange={(e) => set("use_of_funds", e.target.value)} /></EditRow>
          <EditRow label="Description"><textarea className={INPUT} style={inputStyle} rows={3} value={form.business_description} onChange={(e) => set("business_description", e.target.value)} /></EditRow>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" onClick={save} disabled={saving} style={{ fontSize: 12, padding: "7px 16px", borderRadius: 8, border: "none", background: "#2E78F5", color: "white", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Saving…" : "Save changes"}</button>
            <button type="button" onClick={cancel} disabled={saving} style={{ fontSize: 12, padding: "7px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "white", color: "#475569", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
