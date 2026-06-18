"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import type { Company } from "@/lib/supabase/types";
import { FormField } from "@/components/ui/FormField";
import { AIFieldHelper } from "@/components/ui/AIFieldHelper";
import { useFormValidation, type ZodFlatErrors } from "@/hooks/useFormValidation";

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
  // scaling
  return `${amount} will fund ${name}'s next phase of growth:\n\n1. **Market expansion** (~40%) — enter [new geography / vertical / segment]\n2. **Team scaling** (~35%) — senior hires across [engineering / sales / operations]\n3. **Infrastructure & platform** (~25%) — [enterprise readiness / compliance / international infrastructure]\n\nPrimary milestone: [2–3× revenue growth / international launch / profitability path] within [18 months].`;
}

function generateFounderGoalsDraft(company: Company | null): string {
  const name = company?.company_name ?? "Your company";
  const stage = company?.revenue_stage ?? "pre_revenue";

  const horizon = stage === "pre_revenue" || stage === "early_revenue"
    ? "12–18 months"
    : "18–24 months";

  return `Over the next ${horizon}, ${name}'s primary goal is [your most important milestone, e.g. reaching $1M ARR / closing Series A / entering 3 new markets / achieving profitability].\n\nBeyond capital, we're looking for investors who can provide:\n• [Specific value-add #1, e.g. "enterprise sales network in the financial services space"]\n• [Specific value-add #2, e.g. "board-level experience scaling B2B SaaS to Series B"]\n• [Specific value-add #3, e.g. "portfolio synergies with other infrastructure / fintech companies"]\n\nLong-term, we're building ${name} to be [your vision: the category leader / a $X company / a default infrastructure layer for Y].`;
}

/* ── Benchmarks ─────────────────────────────────────────────── */

const DESCRIPTION_BENCHMARK =
  "Investors spend ~8 seconds reading company descriptions. Lead with the problem you solve — not how you solve it. Replace each [bracket] with your specifics, then trim to 3–4 tight sentences.";

const USE_OF_FUNDS_BENCHMARK =
  "Investors want to see capital efficiency. Show the % breakdown, name the primary milestone it funds, and tie the milestone to your next raise. Vague answers like 'marketing and engineering' fail.";

const GOALS_BENCHMARK =
  "This is your chance to filter for the right investors. Be specific about the non-capital value you need — network, board experience, portfolio synergies. Generic answers ('grow the business') signal a first-time fundraiser.";

/* ── Zod schema ─────────────────────────────────────────────── */

const settingsSchema = z.object({
  company_name: z.string().min(2),
  business_description: z.string().min(20),
  industry: z.string().min(2),
  website: z.string().url().optional().or(z.literal("")),
  logo_url: z.string().url().optional().or(z.literal("")),
  revenue_stage: z.string().optional(),
  funding_amount: z.coerce.number().positive().optional().or(z.literal("")),
  use_of_funds: z.string().optional(),
  founder_goals: z.string().optional(),
  team_summary: z.string().max(1000).optional(),
  country: z.string().optional(),
  state: z.string().optional(),
});

type Props = {
  company: Company | null;
};

export function CompanySettingsForm({ company }: Props) {
  const router = useRouter();
  const { getError, inputCls, validate, setApiErrors, clearError } = useFormValidation();

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Basic fields
  const [companyName, setCompanyName] = useState(company?.company_name ?? "");
  const [description, setDescription] = useState(company?.business_description ?? "");
  const [website, setWebsite] = useState(company?.website ?? "");
  const [industry, setIndustry] = useState(company?.industry ?? "");
  const [logoUrl, setLogoUrl] = useState(company?.logo_url ?? "");

  // New fields
  const [revenueStage, setRevenueStage] = useState(company?.revenue_stage ?? "");
  const [fundingAmount, setFundingAmount] = useState(
    company?.funding_amount ? String(Number(company.funding_amount)) : ""
  );
  const [useOfFunds, setUseOfFunds] = useState(company?.use_of_funds ?? "");
  const [founderGoals, setFounderGoals] = useState(company?.founder_goals ?? "");
  const [teamSummary, setTeamSummary] = useState(company?.team_summary ?? "");
  const [country, setCountry] = useState(company?.country ?? "");
  const [state, setState] = useState(company?.state ?? "");

  // Logo upload
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoDragging, setLogoDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadLogo = useCallback(async (file: File) => {
    if (!company) return;
    setLogoUploading(true);
    const form = new FormData();
    form.append("file", file);
    const r = await fetch(`/api/companies/${company.id}/logo`, { method: "POST", body: form });
    const d = await r.json().catch(() => ({}));
    setLogoUploading(false);
    if (r.ok && d.logo_url) {
      setLogoUrl(d.logo_url);
      setMessage({ type: "success", text: "Logo uploaded." });
    } else {
      setMessage({ type: "error", text: d.error ?? "Logo upload failed." });
    }
  }, [company]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setLogoDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void uploadLogo(file);
  }, [uploadLogo]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void uploadLogo(file);
  }, [uploadLogo]);

  const BASE_INPUT = "rounded-xl border px-4 py-3 font-normal w-full";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    if (!company) {
      setMessage({ type: "error", text: "No company profile is linked to your account." });
      return;
    }

    const ok = validate(settingsSchema, {
      company_name: companyName.trim(),
      business_description: description.trim(),
      industry: industry.trim(),
      website: website.trim(),
      logo_url: logoUrl.trim(),
      revenue_stage: revenueStage || undefined,
      funding_amount: fundingAmount.trim() || undefined,
      use_of_funds: useOfFunds.trim() || undefined,
      founder_goals: founderGoals.trim() || undefined,
      team_summary: teamSummary.trim() || undefined,
      country: country.trim() || undefined,
      state: state.trim() || undefined,
    });
    if (!ok) return;

    setIsSaving(true);

    const payload: Record<string, unknown> = {
      company_name: companyName.trim(),
      business_description: description.trim(),
      website: website.trim() || undefined,
      industry: industry.trim(),
      logo_url: logoUrl.trim() || undefined,
    };
    if (revenueStage) payload.revenue_stage = revenueStage;
    if (fundingAmount.trim()) payload.funding_amount = Number(fundingAmount);
    if (useOfFunds.trim()) payload.use_of_funds = useOfFunds.trim();
    if (founderGoals.trim()) payload.founder_goals = founderGoals.trim();
    if (teamSummary.trim()) payload.team_summary = teamSummary.trim();
    if (country.trim()) payload.country = country.trim();
    if (state.trim()) payload.state = state.trim();

    const response = await fetch(`/api/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as {
      error?: string;
      details?: ZodFlatErrors;
    } | null;

    setIsSaving(false);

    if (!response.ok) {
      if (body?.details) {
        setApiErrors(body.details);
      } else {
        setMessage({ type: "error", text: body?.error ?? "Unable to save company settings." });
      }
      return;
    }

    setMessage({ type: "success", text: "Settings saved." });
    router.refresh();
  }

  // Snapshot for AI helpers that depend on current form state
  const liveSnapshot: Company | null = company
    ? { ...company, industry, revenue_stage: revenueStage || company.revenue_stage, funding_amount: fundingAmount ? Number(fundingAmount) : company.funding_amount }
    : null;

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
      {/* Row 1: Company name + Industry */}
      <div className="grid gap-5 md:grid-cols-2">
        <FormField label="Company name" error={getError("company_name")} required>
          <input
            className={`${BASE_INPUT} ${inputCls("company_name")}`}
            value={companyName}
            onChange={(e) => { setCompanyName(e.target.value); clearError("company_name"); }}
            disabled={isSaving}
          />
        </FormField>

        <FormField label="Industry" error={getError("industry")} required>
          <input
            className={`${BASE_INPUT} ${inputCls("industry")}`}
            value={industry}
            onChange={(e) => { setIndustry(e.target.value); clearError("industry"); }}
            disabled={isSaving}
          />
        </FormField>
      </div>

      {/* Row 2: Website */}
      <FormField label="Website" error={getError("website")} hint="Include https:// — e.g. https://example.com">
        <input
          className={`${BASE_INPUT} ${inputCls("website")}`}
          value={website ?? ""}
          onChange={(e) => { setWebsite(e.target.value); clearError("website"); }}
          disabled={isSaving}
          placeholder="https://example.com"
        />
      </FormField>

      {/* Row 3: Logo */}
      <FormField label="Company logo" error={getError("logo_url")} hint="PNG, JPG, WebP or SVG · max 2 MB">
        <div
          onDragOver={(e) => { e.preventDefault(); setLogoDragging(true); }}
          onDragLeave={() => setLogoDragging(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-5 transition-colors ${
            logoDragging ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFileChange}
          />
          {logoUrl ? (
            <img src={logoUrl} alt="Company logo" className="h-14 w-14 rounded-lg object-contain ring-1 ring-slate-200" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200">
              <span className="text-2xl">🏢</span>
            </div>
          )}
          <div className="text-center">
            {logoUploading ? (
              <p className="text-sm font-medium text-indigo-600">Uploading…</p>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-700">
                  {logoUrl ? "Replace logo" : "Drop logo here or click to upload"}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">PNG, JPG, WebP, SVG · max 2 MB</p>
              </>
            )}
          </div>
        </div>
        <input
          className={`${BASE_INPUT} ${inputCls("logo_url")} mt-2 text-xs`}
          value={logoUrl ?? ""}
          onChange={(e) => { setLogoUrl(e.target.value); clearError("logo_url"); }}
          disabled={isSaving}
          placeholder="Or paste a logo URL: https://…"
        />
      </FormField>

      {/* Row 4: Business description */}
      <FormField label="Description" error={getError("business_description")} required hint="Min 20 characters">
        <textarea
          rows={6}
          className={`${BASE_INPUT} ${inputCls("business_description")}`}
          value={description}
          onChange={(e) => { setDescription(e.target.value); clearError("business_description"); }}
          disabled={isSaving}
        />
        <AIFieldHelper
          benchmark={DESCRIPTION_BENCHMARK}
          draft={generateDescriptionDraft(liveSnapshot)}
          onInsert={(text) => { setDescription(text); clearError("business_description"); }}
        />
      </FormField>

      {/* ── Fundraising section ───────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Fundraising details</p>

        {/* Revenue stage */}
        <div className="grid gap-5 md:grid-cols-2">
          <FormField label="Revenue stage" error={getError("revenue_stage")}>
            <select
              className={`${BASE_INPUT} ${inputCls("revenue_stage")} bg-white`}
              value={revenueStage}
              onChange={(e) => { setRevenueStage(e.target.value); clearError("revenue_stage"); }}
              disabled={isSaving}
            >
              <option value="">— Select stage —</option>
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>{s.label} · {s.sub}</option>
              ))}
            </select>
          </FormField>

          {/* Funding amount */}
          <FormField
            label="Funding target (USD)"
            error={getError("funding_amount")}
            hint={
              revenueStage === "pre_revenue" ? "Pre-seed: $150K–$750K · Seed: $500K–$3M" :
              revenueStage === "early_revenue" ? "Seed: $500K–$3M · Series A starts at $3M+" :
              revenueStage === "growing" ? "Series A: $3M–$15M" :
              revenueStage === "scaling" ? "Series B+: $15M+" :
              "Enter the amount you're raising"
            }
          >
            <input
              type="number"
              min={0}
              step={50000}
              className={`${BASE_INPUT} ${inputCls("funding_amount")}`}
              value={fundingAmount}
              onChange={(e) => { setFundingAmount(e.target.value); clearError("funding_amount"); }}
              disabled={isSaving}
              placeholder="e.g. 1500000"
            />
          </FormField>
        </div>

        {/* Use of funds */}
        <div className="mt-5">
          <FormField label="Use of funds" error={getError("use_of_funds")} hint="How will you deploy this round?">
            <textarea
              rows={5}
              className={`${BASE_INPUT} ${inputCls("use_of_funds")}`}
              value={useOfFunds}
              onChange={(e) => { setUseOfFunds(e.target.value); clearError("use_of_funds"); }}
              disabled={isSaving}
              placeholder="Break down how you'll allocate the capital (product, hiring, go-to-market, etc.)…"
            />
            <AIFieldHelper
              benchmark={USE_OF_FUNDS_BENCHMARK}
              draft={generateUseOfFundsDraft(liveSnapshot)}
              onInsert={(text) => { setUseOfFunds(text); clearError("use_of_funds"); }}
            />
          </FormField>
        </div>
      </div>

      {/* ── Investor goals section ────────────────────────────── */}
      <FormField
        label="Founder goals & investor fit"
        error={getError("founder_goals")}
        hint="What milestones are you targeting? What do you need beyond capital?"
      >
        <textarea
          rows={6}
          className={`${BASE_INPUT} ${inputCls("founder_goals")}`}
          value={founderGoals}
          onChange={(e) => { setFounderGoals(e.target.value); clearError("founder_goals"); }}
          disabled={isSaving}
          placeholder="Describe your 12–24 month goals and the kind of investors you're looking for…"
        />
        <AIFieldHelper
          benchmark={GOALS_BENCHMARK}
          draft={generateFounderGoalsDraft(liveSnapshot)}
          onInsert={(text) => { setFounderGoals(text); clearError("founder_goals"); }}
        />
      </FormField>

      {/* ── Team summary ─────────────────────────────────────── */}
      <FormField
        label="Team summary"
        error={getError("team_summary")}
        hint="Brief description of your founding team, key hires, and domain expertise."
      >
        <textarea
          rows={5}
          className={`${BASE_INPUT} ${inputCls("team_summary")}`}
          value={teamSummary}
          onChange={(e) => { setTeamSummary(e.target.value); clearError("team_summary"); }}
          disabled={isSaving}
          placeholder="Describe your founding team's background, key hires, and relevant domain expertise…"
        />
      </FormField>

      {/* ── Location section ─────────────────────────────────── */}
      <div className="grid gap-5 md:grid-cols-2">
        <FormField label="Country" error={getError("country")}>
          <input
            className={`${BASE_INPUT} ${inputCls("country")}`}
            value={country}
            onChange={(e) => { setCountry(e.target.value); clearError("country"); }}
            disabled={isSaving}
            placeholder="e.g. United States"
          />
        </FormField>

        <FormField label="State / Province" error={getError("state")}>
          <input
            className={`${BASE_INPUT} ${inputCls("state")}`}
            value={state}
            onChange={(e) => { setState(e.target.value); clearError("state"); }}
            disabled={isSaving}
            placeholder="e.g. California"
          />
        </FormField>
      </div>

      {message ? (
        <p
          className={
            message.type === "success"
              ? "rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
              : "rounded-xl bg-red-50 p-3 text-sm text-red-700"
          }
        >
          {message.text}
        </p>
      ) : null}

      <button
        className="cap-btn-primary inline-flex justify-center rounded-lg px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
        type="submit"
        disabled={isSaving}
      >
        {isSaving ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
