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
  annual_revenue_size: string; arr: string; mrr: string; key_highlights: string;
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
    annual_revenue_size: c.annualRevenueSize ?? "", arr: c.arr ?? "", mrr: c.mrr ?? "",
    key_highlights: c.keyHighlights ?? "",
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

/**
 * A blank field means one of three different things, and a bare dash says all
 * three at once. `unasked` marks a field the onboarding wizard has not yet put
 * to the founder, so staff can tell "chase the founder" from "they left it
 * blank" without opening the founder's account.
 */
function ViewRow({ label, children, unasked = false }: { label: string; children: React.ReactNode; unasked?: boolean }) {
  const empty = children == null || children === "" || (Array.isArray(children) && children.length === 0);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", alignItems: "flex-start", padding: "5px 0", fontSize: 12.5, borderBottom: "0.5px solid #f1f5f9" }}>
      <span style={LBL}>{label}</span>
      <span style={{ flex: "1 1 160px", minWidth: 0, color: empty ? "var(--muted-foreground)" : "var(--foreground)", overflowWrap: "anywhere" }}>
        {!empty ? children : unasked
          ? <span style={{ fontStyle: "italic", fontSize: 11.5 }}>not asked yet</span>
          : "—"}
      </span>
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
          annual_revenue_size: form.annual_revenue_size.trim() || null,
          arr: form.arr.trim() || null,
          mrr: form.mrr.trim() || null,
          key_highlights: form.key_highlights.trim() || null,
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
  // Blank because the wizard hasn't asked, rather than because the answer is none.
  const unasked = !company.fundingInfoCaptured;
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

      {/* Everything below "One-pager" is collected in the wizard's
          `funding_information` step. Until the founder submits it, those fields
          are blank because nobody has asked — not because they have no answer. */}
      {!editing && !company.fundingInfoCaptured ? (
        <div style={{ display: "flex", gap: 7, alignItems: "flex-start", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "7px 9px", marginBottom: 8 }}>
          <i className="ti ti-progress-alert" aria-hidden="true" style={{ color: "#B45309", fontSize: 14, marginTop: 1 }} />
          <span style={{ fontSize: 11.5, color: "#78350F", lineHeight: 1.5 }}>
            <b>Onboarding stopped before the funding step.</b> Stage, capital sought, EBITDA and
            management team are collected there, so they have not been asked yet.
          </span>
        </div>
      ) : null}

      {!editing ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0 28px" }}>
          <ViewRow label="Industry">{data.industry ? pill(data.industry) : null}</ViewRow>
          <ViewRow label="Revenue stage" unasked={unasked}>{data.revenue_stage ? pill(stageLabel) : null}</ViewRow>
          <ViewRow label="Funding target" unasked={unasked}>{data.funding_amount ? `$${Number(data.funding_amount).toLocaleString()}` : null}</ViewRow>
          <ViewRow label="Website">{data.website ? <a href={data.website} target="_blank" rel="noopener noreferrer" style={{ color: "#185FA5", textDecoration: "none" }}>{data.website}</a> : null}</ViewRow>
          <ViewRow label="Location">{[data.state, data.country].filter(Boolean).join(", ") || null}</ViewRow>
          <ViewRow label="One-pager">{onePager?.slug ? <a href={`/f/${onePager.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: "#185FA5", textDecoration: "none" }}>/f/{onePager.slug}{onePager.published ? " · Published" : " · Draft"}</a> : null}</ViewRow>
          <ViewRow label="Funding stage" unasked={unasked}>{data.funding_stage.join(", ") || null}</ViewRow>
          <ViewRow label="Operating stage" unasked={unasked}>{data.operating_stage.join(", ") || null}</ViewRow>
          <ViewRow label="Business entity" unasked={unasked}>{data.business_entity || null}</ViewRow>
          <ViewRow label="Annual revenue size" unasked={unasked}>{data.annual_revenue_size || null}</ViewRow>
          <ViewRow label="Annual EBITDA" unasked={unasked}>{data.annual_ebitda || null}</ViewRow>
          <ViewRow label="ARR" unasked={unasked}>{data.arr || null}</ViewRow>
          <ViewRow label="MRR" unasked={unasked}>{data.mrr || null}</ViewRow>
          <ViewRow label="Type of investor(s)" unasked={unasked}>{data.seeking_investor_types.join(", ") || null}</ViewRow>
          <ViewRow label="Type(s) of capital" unasked={unasked}>{data.seeking_capital_types.join(", ") || null}</ViewRow>
          <ViewRow label="Active investor preference" unasked={unasked}>{data.active_investor_preference.join(", ") || null}</ViewRow>
          <ViewRow label="Management team" unasked={unasked}>{data.management_team || null}</ViewRow>
          <div style={{ gridColumn: "1 / -1" }}><ViewRow label="Use of funds" unasked={unasked}>{data.use_of_funds || null}</ViewRow></div>
          <div style={{ gridColumn: "1 / -1" }}><ViewRow label="Description">{data.business_description || null}</ViewRow></div>
          <div style={{ gridColumn: "1 / -1" }}><ViewRow label="Key highlights" unasked={unasked}>{data.key_highlights || null}</ViewRow></div>
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
          <EditRow label="Annual revenue size"><input className={INPUT} style={inputStyle} value={form.annual_revenue_size} onChange={(e) => set("annual_revenue_size", e.target.value)} placeholder="e.g. $1.4M" /></EditRow>
          <EditRow label="Annual EBITDA"><input className={INPUT} style={inputStyle} value={form.annual_ebitda} onChange={(e) => set("annual_ebitda", e.target.value)} placeholder="e.g. -$120,000" /></EditRow>
          <EditRow label="ARR"><input className={INPUT} style={inputStyle} value={form.arr} onChange={(e) => set("arr", e.target.value)} placeholder="e.g. $840,000" /></EditRow>
          <EditRow label="MRR"><input className={INPUT} style={inputStyle} value={form.mrr} onChange={(e) => set("mrr", e.target.value)} placeholder="e.g. $70,000" /></EditRow>
          <EditRow label="Type of investor(s)"><Chips options={INVESTOR_TYPE_OPTS} value={form.seeking_investor_types} onToggle={(v) => toggle("seeking_investor_types", v)} /></EditRow>
          <EditRow label="Type(s) of capital"><Chips options={CAPITAL_TYPE_OPTS} value={form.seeking_capital_types} onToggle={(v) => toggle("seeking_capital_types", v)} /></EditRow>
          <EditRow label="Active investor preference"><Chips options={INVESTOR_PREF_OPTS} value={form.active_investor_preference} onToggle={(v) => toggle("active_investor_preference", v)} /></EditRow>
          <EditRow label="Management team"><input className={INPUT} style={inputStyle} value={form.management_team} onChange={(e) => set("management_team", e.target.value)} placeholder="e.g. 2 co-founders, 3 full-time" /></EditRow>
          <EditRow label="Use of funds"><input className={INPUT} style={inputStyle} value={form.use_of_funds} onChange={(e) => set("use_of_funds", e.target.value)} /></EditRow>
          <EditRow label="Description"><textarea className={INPUT} style={inputStyle} rows={3} value={form.business_description} onChange={(e) => set("business_description", e.target.value)} /></EditRow>
          <EditRow label="Key highlights"><textarea className={INPUT} style={inputStyle} rows={2} value={form.key_highlights} onChange={(e) => set("key_highlights", e.target.value)} placeholder="The three or four facts an investor should take away." /></EditRow>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" onClick={save} disabled={saving} style={{ fontSize: 12, padding: "7px 16px", borderRadius: 8, border: "none", background: "#2E78F5", color: "white", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Saving…" : "Save changes"}</button>
            <button type="button" onClick={cancel} disabled={saving} style={{ fontSize: 12, padding: "7px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "white", color: "#475569", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
