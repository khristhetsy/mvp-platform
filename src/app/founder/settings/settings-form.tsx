"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Company } from "@/lib/supabase/types";
import { AIFieldHelper } from "@/components/ui/AIFieldHelper";
import { useFormValidation } from "@/hooks/useFormValidation";
import { industryOptionsFor } from "@/lib/industries";

/* ── Revenue stage options ──────────────────────────────────── */

const STAGES = [
  { id: "pre_revenue",   label: "Pre-revenue",   sub: "Idea, prototype, or early development" },
  { id: "early_revenue", label: "Early revenue", sub: "Up to $100K ARR" },
  { id: "growing",       label: "Growing",       sub: "$100K – $1M ARR" },
  { id: "scaling",       label: "Scaling",       sub: "$1M+ ARR" },
];

/* ── Draft generators ───────────────────────────────────────── */

function generateDescriptionDraft(company: Company | null): string {
  const name = company?.company_name ?? "Your company";
  const ind   = (company?.industry ?? "").toLowerCase();
  const stage = company?.revenue_stage ?? "pre_revenue";

  const stageNote =
    stage === "pre_revenue"
      ? ""
      : `\n\nCurrently at [${stage.replaceAll("_", " ")} stage], we're focused on [next growth lever, e.g. expanding to new markets / scaling the sales team].`;

  if (ind.includes("fintech") || ind.includes("financial")) {
    return `${name} is a fintech platform helping [target customers, e.g. SMBs / consumers / enterprises] [manage/process/automate] [payments/lending/financial operations] without [key pain point, e.g. high fees / slow processing / manual complexity].\n\nWe [your core differentiator]. Unlike [legacy banks / traditional providers], ${name} [your key advantage].${stageNote}`;
  }
  if (ind.includes("health")) {
    return `${name} is a healthtech company enabling [patients / providers / health systems] to [access / deliver / streamline] [care / diagnostics / records] [better / faster / more affordably].\n\nWe [your mechanism]. Our [product / platform] helps [target] [outcome] while [secondary benefit, e.g. reducing admin burden / cutting costs].${stageNote}`;
  }
  if (ind.includes("saas") || ind.includes("software") || ind.includes("b2b")) {
    return `${name} is a [B2B / enterprise / SMB-focused] software platform that helps [target buyer, e.g. ops teams / CFOs / HR leaders] [achieve outcome] by [mechanism].\n\nUnlike [legacy approach / spreadsheets / manual processes], we [your key advantage]. Customers typically see [X% improvement / time saved] within [timeframe].${stageNote}`;
  }
  if (ind.includes("edtech") || ind.includes("education")) {
    return `${name} is an edtech platform helping [students / teachers / institutions] [learn / teach / manage] [subject / curriculum / outcomes] more effectively.\n\nWe [your mechanism]. Unlike [traditional approach], ${name} [your key differentiator, e.g. personalises learning / reduces teacher workload / improves completion rates].${stageNote}`;
  }
  if (ind.includes("cleantech") || ind.includes("climate") || ind.includes("energy")) {
    return `${name} is a cleantech company helping [enterprises / utilities / consumers] [reduce / measure / offset] [carbon emissions / energy costs / waste] through [mechanism].\n\nWe [your solution]. Unlike [traditional approach], ${name} [your key advantage, e.g. requires no capital expenditure / integrates in weeks / delivers measurable ROI].${stageNote}`;
  }
  if (ind.includes("marketplace")) {
    return `${name} is a marketplace connecting [buyers / demand side] with [sellers / supply side] in the [industry] space.\n\nWe [how you create value for both sides]. Unlike [existing alternatives], ${name} [your key advantage, e.g. reduces friction / improves trust / expands access].${stageNote}`;
  }
  if (ind.includes("e-commerce") || ind.includes("commerce") || ind.includes("retail")) {
    return `${name} is an e-commerce company that helps [consumers / retailers / brands] [discover / buy / sell] [product category] [better / faster / more affordably].\n\nWe [your mechanism]. Unlike [Amazon / legacy retailers / traditional brands], ${name} [your key differentiator].${stageNote}`;
  }
  if (ind.includes("ai") || ind.includes("ml") || ind.includes("machine learning")) {
    return `${name} is an AI platform that helps [target users, e.g. operations teams / analysts / developers] [automate / predict / analyse] [workflow / data / decisions] [faster / more accurately / at lower cost].\n\nWe [your core technology]. Unlike [rule-based tools / manual processes], ${name} [your key advantage].${stageNote}`;
  }
  if (ind.includes("real estate") || ind.includes("property")) {
    return `${name} is a proptech platform that helps [buyers / sellers / landlords / brokers] [find / manage / transact] [property / leases / investments] [faster / more transparently / at lower cost].\n\nWe [your mechanism]. Unlike [traditional agents / legacy platforms], ${name} [your key advantage].${stageNote}`;
  }
  if (ind.includes("logistic") || ind.includes("supply chain") || ind.includes("delivery")) {
    return `${name} is a logistics platform that helps [shippers / carriers / warehouses] [optimise / track / automate] [deliveries / routes / inventory] [faster / at lower cost / with greater visibility].\n\nWe [your mechanism]. Unlike [legacy TMS / manual coordination], ${name} [your key advantage].${stageNote}`;
  }

  return `${name} is a [industry] company that helps [target customers] [achieve a specific outcome] by [your mechanism or approach].\n\nUnlike [existing alternatives], we [your key differentiator]. [One sentence on traction or why now, e.g. "We've signed our first 3 enterprise customers" or "The regulatory environment is shifting — now is the right time."]${stageNote}`;
}

function generateUseOfFundsDraft(company: Company | null): string {
  const name = company?.company_name ?? "Your company";
  const stage = company?.revenue_stage ?? "pre_revenue";
  const amount = company?.funding_amount ? `$${Number(company.funding_amount).toLocaleString()}` : "this round";

  if (stage === "pre_revenue") {
    return `${amount} will be deployed over [12–18 months] across three areas:\n\n1. **Product development** (~40%) — complete [specific milestone, e.g. MVP v1 / beta launch / core feature set]\n2. **Early customer acquisition** (~35%) — [first X paying customers / pilot programme / design partners]\n3. **Operations & infrastructure** (~25%) — cloud costs, legal/compliance setup, and founding team salaries\n\nPrimary milestone: [your key proof point, e.g. "achieving $10K MRR" / "closing first enterprise contract" / "reaching 1,000 active users"]`;
  }
  if (stage === "early_revenue") {
    return `${amount} will be deployed over [12–18 months] to accelerate growth:\n\n1. **Sales & marketing** (~45%) — hire [first AE / growth lead], build demand generation, target [$X ARR / X new customers]\n2. **Product & engineering** (~35%) — [key feature, e.g. integrations / enterprise tier / self-serve onboarding]\n3. **Team & operations** (~20%) — [2–3 key hires in engineering/customer success]\n\nPrimary milestone: reaching [$100K ARR / $X MRR] and demonstrating repeatable sales motion.`;
  }
  if (stage === "growing") {
    return `${amount} will accelerate ${name}'s path to scale over [18–24 months]:\n\n1. **Go-to-market** (~50%) — expand sales team, marketing, and [new channel / geography / vertical]\n2. **Product** (~30%) — [platform expansion, e.g. enterprise features / API / mobile]\n3. **Operations** (~20%) — hire [VP Sales / Head of Marketing / CTO] and build supporting infrastructure\n\nPrimary milestone: reaching [$1M ARR / Series A readiness] within [12 months of close].`;
  }
  return `${amount} will fund ${name}'s next phase of growth:\n\n1. **Market expansion** (~40%) — enter [new geography / vertical / segment]\n2. **Team scaling** (~35%) — senior hires across [engineering / sales / operations]\n3. **Infrastructure & platform** (~25%) — [enterprise readiness / compliance / international infrastructure]\n\nPrimary milestone: [2–3× revenue growth / international launch / profitability path] within [18 months].`;
}

function generateFounderGoalsDraft(company: Company | null): string {
  const name = company?.company_name ?? "Your company";
  const stage = company?.revenue_stage ?? "pre_revenue";
  const horizon = stage === "pre_revenue" || stage === "early_revenue" ? "12–18 months" : "18–24 months";
  return `Over the next ${horizon}, ${name}'s primary goal is [your most important milestone, e.g. reaching $1M ARR / closing Series A / entering 3 new markets / achieving profitability].\n\nBeyond capital, we're looking for investors who can provide:\n• [Specific value-add #1, e.g. "enterprise sales network in the financial services space"]\n• [Specific value-add #2, e.g. "board-level experience scaling B2B SaaS to Series B"]\n• [Specific value-add #3, e.g. "portfolio synergies with other infrastructure / fintech companies"]\n\nLong-term, we're building ${name} to be [your vision: the category leader / a $X company / a default infrastructure layer for Y].`;
}

const DESCRIPTION_BENCHMARK =
  "Investors spend ~8 seconds reading company descriptions. Lead with the problem you solve — not how you solve it. Replace each [bracket] with your specifics, then trim to 3–4 tight sentences.";
const USE_OF_FUNDS_BENCHMARK =
  "Investors want to see capital efficiency. Show the % breakdown, name the primary milestone it funds, and tie the milestone to your next raise. Vague answers like 'marketing and engineering' fail.";
const GOALS_BENCHMARK =
  "This is your chance to filter for the right investors. Be specific about the non-capital value you need — network, board experience, portfolio synergies. Generic answers ('grow the business') signal a first-time fundraiser.";

/* ── Field definitions (one combined list) ──────────────────── */

type FieldType = "text" | "select-industry" | "select-stage" | "number" | "textarea" | "logo";
type FieldDef = { key: string; label: string; type: FieldType; required?: boolean; placeholder?: string; ai?: "description" | "useOfFunds" | "goals" };

const FIELDS: FieldDef[] = [
  { key: "company_name", label: "Company name", type: "text", required: true },
  { key: "industry", label: "Industry", type: "select-industry", required: true },
  { key: "website", label: "Website", type: "text", placeholder: "https://example.com" },
  { key: "logo_url", label: "Company logo", type: "logo" },
  { key: "business_description", label: "Description", type: "textarea", required: true, ai: "description" },
  { key: "revenue_stage", label: "Revenue stage", type: "select-stage" },
  { key: "funding_amount", label: "Funding target (USD)", type: "number", placeholder: "e.g. 1500000" },
  { key: "use_of_funds", label: "Use of funds", type: "textarea", ai: "useOfFunds" },
  { key: "founder_goals", label: "Founder goals & investor fit", type: "textarea", ai: "goals" },
  { key: "team_summary", label: "Team summary", type: "textarea" },
  { key: "country", label: "Country", type: "text", placeholder: "e.g. United States" },
  { key: "state", label: "State / Province", type: "text", placeholder: "e.g. California" },
  { key: "incorporation_jurisdiction", label: "Country of incorporation", type: "text", placeholder: "e.g. Delaware C-Corp" },
];

type Props = { company: Company | null };

export function CompanySettingsForm({ company }: Props) {
  const router = useRouter();
  const { getError, setApiErrors, clearError } = useFormValidation();

  const seed = useMemo<Record<string, string>>(() => ({
    company_name: company?.company_name ?? "",
    business_description: company?.business_description ?? "",
    website: company?.website ?? "",
    industry: company?.industry ?? "",
    logo_url: company?.logo_url ?? "",
    revenue_stage: company?.revenue_stage ?? "",
    funding_amount: company?.funding_amount ? String(Number(company.funding_amount)) : "",
    use_of_funds: company?.use_of_funds ?? "",
    founder_goals: company?.founder_goals ?? "",
    team_summary: company?.team_summary ?? "",
    country: company?.country ?? "",
    state: company?.state ?? "",
    incorporation_jurisdiction: company?.incorporation_jurisdiction ?? "",
  }), [company]);

  const [values, setValues] = useState<Record<string, string>>(seed);
  const [orig, setOrig] = useState<Record<string, string>>(seed);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setVal = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const liveSnapshot: Company | null = company
    ? { ...company, industry: values.industry, revenue_stage: values.revenue_stage || company.revenue_stage, funding_amount: values.funding_amount ? Number(values.funding_amount) : company.funding_amount }
    : null;

  async function saveField(key: string) {
    if (!company) { setMessage({ type: "error", text: "No company profile is linked to your account." }); return; }
    const trimmed = (values[key] ?? "").trim();
    if (trimmed === (orig[key] ?? "").trim()) { setEditingKey(null); return; }

    const def = FIELDS.find((f) => f.key === key);
    if (def?.required && trimmed.length < (key === "business_description" ? 20 : 2)) {
      setApiErrors({ formErrors: [], fieldErrors: { [key]: [key === "business_description" ? "At least 20 characters." : "This field is required."] } });
      return;
    }

    setIsSaving(true);
    setMessage(null);
    clearError(key);
    const payload: Record<string, unknown> = key === "funding_amount"
      ? (trimmed ? { funding_amount: Number(trimmed) } : {})
      : { [key]: trimmed };
    const res = await fetch(`/api/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => null)) as { error?: string; details?: { formErrors: string[]; fieldErrors: Record<string, string[]> } } | null;
    setIsSaving(false);
    if (!res.ok) {
      if (body?.details) setApiErrors(body.details);
      else setMessage({ type: "error", text: body?.error ?? "Unable to save." });
      return;
    }
    setOrig((p) => ({ ...p, [key]: values[key] ?? "" }));
    setEditingKey(null);
    setMessage({ type: "success", text: "Saved." });
    router.refresh();
  }

  function revert(key: string) {
    setVal(key, orig[key] ?? "");
    clearError(key);
    setEditingKey(null);
  }

  const uploadLogo = useCallback(async (file: File) => {
    if (!company) return;
    setLogoUploading(true);
    const form = new FormData();
    form.append("file", file);
    const r = await fetch(`/api/companies/${company.id}/logo`, { method: "POST", body: form });
    const d = await r.json().catch(() => ({}));
    setLogoUploading(false);
    if (r.ok && d.logo_url) {
      setVal("logo_url", d.logo_url);
      setOrig((p) => ({ ...p, logo_url: d.logo_url }));
      // Persist the URL onto the company record too.
      await fetch(`/api/companies/${company.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logo_url: d.logo_url }) }).catch(() => {});
      setMessage({ type: "success", text: "Logo uploaded." });
      router.refresh();
    } else {
      setMessage({ type: "error", text: d.error ?? "Logo upload failed." });
    }
  }, [company, router]);

  function displayNode(f: FieldDef) {
    const v = values[f.key] ?? "";
    if (!v) return <span className="text-slate-400">—</span>;
    if (f.key === "funding_amount") return <span className="text-slate-800">${Number(v).toLocaleString()}</span>;
    if (f.type === "select-stage") {
      const s = STAGES.find((x) => x.id === v);
      return <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] text-indigo-800">{s ? `${s.label} · ${s.sub}` : v}</span>;
    }
    if (f.type === "select-industry") return <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] text-indigo-800">{v}</span>;
    if (f.key === "website") return <span className="text-[#185FA5]">{v}</span>;
    if (f.type === "logo") return <img src={v} alt="Company logo" className="h-8 w-8 rounded-lg object-contain ring-1 ring-slate-200" />;
    if (f.type === "textarea") return <span className="whitespace-pre-wrap text-slate-800">{v.length > 220 ? `${v.slice(0, 220)}…` : v}</span>;
    return <span className="text-slate-800">{v}</span>;
  }

  const editInputCls = "w-full rounded-lg border border-indigo-400 px-3 py-2 text-sm outline-none";
  const editRing: React.CSSProperties = { boxShadow: "0 0 0 2px #EEEDFE" };

  function editControl(f: FieldDef) {
    const v = values[f.key] ?? "";
    if (f.type === "select-industry") {
      return (
        <select className={editInputCls} style={editRing} value={v} onChange={(e) => setVal(f.key, e.target.value)} autoFocus>
          {!v ? <option value="">— Select an industry —</option> : null}
          {industryOptionsFor(v).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }
    if (f.type === "select-stage") {
      return (
        <select className={editInputCls} style={editRing} value={v} onChange={(e) => setVal(f.key, e.target.value)} autoFocus>
          <option value="">— Select stage —</option>
          {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label} · {s.sub}</option>)}
        </select>
      );
    }
    if (f.type === "number") {
      return <input type="number" min={0} step={50000} className={editInputCls} style={editRing} value={v} placeholder={f.placeholder} onChange={(e) => setVal(f.key, e.target.value)} autoFocus />;
    }
    if (f.type === "textarea") {
      const draft = f.ai === "description" ? generateDescriptionDraft(liveSnapshot) : f.ai === "useOfFunds" ? generateUseOfFundsDraft(liveSnapshot) : generateFounderGoalsDraft(liveSnapshot);
      const benchmark = f.ai === "description" ? DESCRIPTION_BENCHMARK : f.ai === "useOfFunds" ? USE_OF_FUNDS_BENCHMARK : GOALS_BENCHMARK;
      return (
        <>
          <textarea rows={5} className={editInputCls} style={editRing} value={v} placeholder={f.placeholder} onChange={(e) => setVal(f.key, e.target.value)} autoFocus />
          {f.ai ? <AIFieldHelper benchmark={benchmark} draft={draft} onInsert={(text) => setVal(f.key, text)} /> : null}
        </>
      );
    }
    if (f.type === "logo") {
      return (
        <div>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-3 hover:border-indigo-300"
          >
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadLogo(file); }} />
            {v ? <img src={v} alt="Company logo" className="h-10 w-10 rounded-lg object-contain ring-1 ring-slate-200" /> : <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200 text-lg">🏢</div>}
            <span className="text-sm text-slate-600">{logoUploading ? "Uploading…" : v ? "Replace logo" : "Click to upload"} <span className="text-xs text-slate-400">· PNG, JPG, WebP, SVG · max 2 MB</span></span>
          </div>
          <input className={`${editInputCls} mt-2 text-xs`} value={v} placeholder="Or paste a logo URL: https://…" onChange={(e) => setVal(f.key, e.target.value)} />
        </div>
      );
    }
    return <input className={editInputCls} style={editRing} value={v} placeholder={f.placeholder} onChange={(e) => setVal(f.key, e.target.value)} autoFocus />;
  }

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-end">
        <span className="text-xs text-slate-400">Click any field to edit</span>
      </div>

      <div>
        {FIELDS.map((f) => {
          const editing = editingKey === f.key;
          const err = getError(f.key);
          if (editing) {
            return (
              <div key={f.key} className="flex flex-col gap-2 rounded-lg bg-slate-50 px-3 py-3 md:flex-row md:gap-4 md:items-start">
                <span className="w-40 shrink-0 pt-2 text-sm text-slate-500">{f.label}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">{editControl(f)}</div>
                    <button onClick={() => saveField(f.key)} disabled={isSaving} aria-label="Save" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white disabled:opacity-50">✓</button>
                    <button onClick={() => revert(f.key)} aria-label="Undo" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-500">↩</button>
                  </div>
                  {err ? <p className="mt-1 text-xs text-red-600">{err}</p> : null}
                </div>
              </div>
            );
          }
          return (
            <div key={f.key} onClick={() => { setEditingKey(f.key); setMessage(null); }} className="group flex cursor-pointer items-start gap-4 border-b border-slate-100 py-2.5 last:border-0 hover:bg-slate-50/60 rounded-md px-1 -mx-1">
              <span className="w-40 shrink-0 text-sm text-slate-500">{f.label}</span>
              <span className="min-w-0 flex-1 text-sm">{displayNode(f)}</span>
              <span className="opacity-0 group-hover:opacity-100 text-slate-400 text-xs pt-0.5">✎</span>
            </div>
          );
        })}
      </div>

      {message ? (
        <p className={message.type === "success" ? "mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" : "mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
