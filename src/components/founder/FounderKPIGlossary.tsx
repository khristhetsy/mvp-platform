"use client";

import { useState, useMemo } from "react";

// ---------------------------------------------------------------------------
// Types & data
// ---------------------------------------------------------------------------

type KPICategory = "Revenue" | "Retention" | "Unit economics" | "Financials" | "Growth";

type KPIEntry = {
  id: string;
  term: string;
  acronym?: string;
  category: KPICategory;
  definition: string;
  whyMatters: string;
  formula: string;
  example: string;
  goodBenchmark: string;
  redFlag: string;
  calculator?: {
    inputs: { id: string; label: string; placeholder: string; prefix?: string; suffix?: string }[];
    compute: (vals: Record<string, number>) => { label: string; value: string }[];
  };
};

const KPI_DATA: KPIEntry[] = [
  {
    id: "arr",
    term: "Annual Recurring Revenue",
    acronym: "ARR",
    category: "Revenue",
    definition: "The annualised value of all active subscription contracts. Excludes one-time fees, professional services, and variable usage revenue.",
    whyMatters: "ARR is the primary valuation driver for SaaS companies. It tells investors the predictable revenue base — the floor your business is built on.",
    formula: "ARR = MRR × 12",
    example: "If you have 20 customers each paying $500/month, your MRR is $10,000 and ARR is $120,000.",
    goodBenchmark: "Series A target: $1–3M ARR. Seed: $100K–$1M. Pre-seed: any paying customers.",
    redFlag: "ARR that includes one-time revenue, pilots, or non-recurring contracts is misleading. Investors will find it during diligence.",
    calculator: {
      inputs: [
        { id: "mrr", label: "MRR ($)", placeholder: "10000", prefix: "$" },
      ],
      compute: (v) => [
        { label: "ARR", value: `$${((v.mrr ?? 0) * 12).toLocaleString()}` },
      ],
    },
  },
  {
    id: "mrr",
    term: "Monthly Recurring Revenue",
    acronym: "MRR",
    category: "Revenue",
    definition: "The predictable monthly revenue from active subscriptions. The most important operational metric for SaaS businesses.",
    whyMatters: "MRR tells you if your business is growing month-over-month. Investors look at the MRR trend, not just the number.",
    formula: "MRR = sum of all active monthly subscription values",
    example: "10 customers at $200/month + 5 customers at $600/month = $2,000 + $3,000 = $5,000 MRR.",
    goodBenchmark: "10–20% MoM growth is strong at pre-seed/seed. 5–10% is solid at Series A.",
    redFlag: "Flat or declining MRR before product-market fit is a serious signal. Check if it's churn, sales slowdown, or both.",
    calculator: {
      inputs: [
        { id: "customers", label: "Customers", placeholder: "20" },
        { id: "avg_price", label: "Avg monthly price ($)", placeholder: "500", prefix: "$" },
      ],
      compute: (v) => [
        { label: "MRR", value: `$${((v.customers ?? 0) * (v.avg_price ?? 0)).toLocaleString()}` },
        { label: "ARR", value: `$${((v.customers ?? 0) * (v.avg_price ?? 0) * 12).toLocaleString()}` },
      ],
    },
  },
  {
    id: "churn",
    term: "Monthly Churn Rate",
    acronym: "Churn",
    category: "Retention",
    definition: "The percentage of MRR or customers lost in a given month. Gross churn measures revenue lost; net churn accounts for expansion revenue.",
    whyMatters: "Churn is the enemy of compounding growth. A 3% monthly churn means you lose ~30% of your base every year — you have to run just to stand still.",
    formula: "Gross Churn = MRR Lost ÷ MRR at Start of Period",
    example: "If you start the month with $100K MRR and lose $2K to churned customers, gross churn is 2%.",
    goodBenchmark: "< 1% monthly for B2B SaaS. < 0.5% for enterprise. 2%+ monthly is a red flag in most segments.",
    redFlag: "Churn that's higher in months 1–3 than 4–12 signals an onboarding or fit problem, not a product problem.",
    calculator: {
      inputs: [
        { id: "mrr_start", label: "MRR at start of month ($)", placeholder: "100000", prefix: "$" },
        { id: "mrr_lost", label: "MRR lost to churn ($)", placeholder: "2000", prefix: "$" },
      ],
      compute: (v) => {
        const churn = v.mrr_start > 0 ? ((v.mrr_lost ?? 0) / v.mrr_start) * 100 : 0;
        const annualised = 1 - Math.pow(1 - churn / 100, 12);
        return [
          { label: "Monthly churn", value: `${churn.toFixed(2)}%` },
          { label: "Implied annual churn", value: `${(annualised * 100).toFixed(1)}%` },
        ];
      },
    },
  },
  {
    id: "nrr",
    term: "Net Revenue Retention",
    acronym: "NRR",
    category: "Retention",
    definition: "The percentage of revenue retained from your existing customer base after accounting for churn, downgrades, and expansion (upsell/cross-sell). Also called Net Dollar Retention (NDR).",
    whyMatters: "NRR > 100% means your existing customers grow revenue on their own — you can grow without acquiring a single new customer. It's the most powerful signal of product-market fit.",
    formula: "NRR = (Starting MRR + Expansion MRR − Churn MRR − Contraction MRR) ÷ Starting MRR × 100",
    example: "Start: $100K MRR. Expansion: +$15K. Churn: −$8K. Contraction: −$2K. NRR = $105K ÷ $100K = 105%.",
    goodBenchmark: "100%+ is the minimum for a healthy SaaS business. 120%+ is exceptional. Top-tier companies (Snowflake, Twilio) have hit 130–160%.",
    redFlag: "NRR consistently below 90% means you're losing ground from your existing base — a structural problem, not just a growth one.",
    calculator: {
      inputs: [
        { id: "mrr_start", label: "Starting MRR ($)", placeholder: "100000", prefix: "$" },
        { id: "expansion", label: "Expansion MRR ($)", placeholder: "15000", prefix: "$" },
        { id: "churn_mrr", label: "Churned MRR ($)", placeholder: "8000", prefix: "$" },
        { id: "contraction", label: "Contraction MRR ($)", placeholder: "2000", prefix: "$" },
      ],
      compute: (v) => {
        const nrr = v.mrr_start > 0
          ? (((v.mrr_start ?? 0) + (v.expansion ?? 0) - (v.churn_mrr ?? 0) - (v.contraction ?? 0)) / v.mrr_start) * 100
          : 0;
        return [{ label: "NRR", value: `${nrr.toFixed(1)}%` }];
      },
    },
  },
  {
    id: "cac",
    term: "Customer Acquisition Cost",
    acronym: "CAC",
    category: "Unit economics",
    definition: "The fully-loaded cost to acquire one new paying customer. Includes sales salaries, marketing spend, commissions, and tools — divided by new customers in the period.",
    whyMatters: "CAC tells you the price of growth. If it costs more to acquire a customer than they'll ever pay you, the business model doesn't work.",
    formula: "CAC = Total Sales & Marketing Spend ÷ New Customers Acquired",
    example: "You spend $30K on sales and marketing in Q1 and acquire 25 new customers. CAC = $30K ÷ 25 = $1,200.",
    goodBenchmark: "CAC should be recoverable in 12–18 months for SaaS. LTV/CAC > 3× is the standard benchmark.",
    redFlag: "CAC that rises as you scale suggests your early wins were from your network, not a repeatable channel.",
    calculator: {
      inputs: [
        { id: "spend", label: "Sales & marketing spend ($)", placeholder: "30000", prefix: "$" },
        { id: "new_customers", label: "New customers acquired", placeholder: "25" },
      ],
      compute: (v) => [
        { label: "CAC", value: v.new_customers > 0 ? `$${Math.round((v.spend ?? 0) / v.new_customers).toLocaleString()}` : "—" },
      ],
    },
  },
  {
    id: "ltv",
    term: "Customer Lifetime Value",
    acronym: "LTV",
    category: "Unit economics",
    definition: "The total gross profit you expect to generate from a customer over the duration of the relationship.",
    whyMatters: "LTV vs. CAC is the fundamental unit economics ratio. A high LTV relative to CAC means every dollar of sales investment generates strong returns.",
    formula: "LTV = (ACV × Gross Margin %) ÷ Annual Churn Rate",
    example: "ACV $6,000, gross margin 70%, annual churn 20%. LTV = ($6,000 × 0.70) ÷ 0.20 = $21,000.",
    goodBenchmark: "LTV/CAC > 3× is the standard SaaS benchmark. > 5× at scale is excellent.",
    redFlag: "LTV calculations that exclude churn or use revenue instead of gross profit overstate unit economics significantly.",
    calculator: {
      inputs: [
        { id: "acv", label: "ACV ($)", placeholder: "6000", prefix: "$" },
        { id: "gross_margin", label: "Gross margin (%)", placeholder: "70", suffix: "%" },
        { id: "annual_churn", label: "Annual churn rate (%)", placeholder: "20", suffix: "%" },
        { id: "cac_val", label: "CAC ($) — for LTV/CAC", placeholder: "1200", prefix: "$" },
      ],
      compute: (v) => {
        const ltv = v.annual_churn > 0 ? (v.acv ?? 0) * ((v.gross_margin ?? 0) / 100) / ((v.annual_churn ?? 0) / 100) : 0;
        const ratio = v.cac_val > 0 ? ltv / v.cac_val : 0;
        return [
          { label: "LTV", value: `$${Math.round(ltv).toLocaleString()}` },
          { label: "LTV / CAC", value: ratio > 0 ? `${ratio.toFixed(1)}×` : "—" },
        ];
      },
    },
  },
  {
    id: "burn",
    term: "Monthly Burn Rate",
    acronym: "Burn",
    category: "Financials",
    definition: "The amount of cash the company spends per month net of revenue. Gross burn is total monthly spend; net burn subtracts revenue.",
    whyMatters: "Burn rate determines your runway. Every dollar of burn is a dollar closer to zero. Knowing this number — and which levers affect it — is a core founder responsibility.",
    formula: "Net Burn = Total Monthly Expenses − Monthly Revenue",
    example: "Monthly expenses of $120K and $40K MRR. Net burn = $120K − $40K = $80K/month.",
    goodBenchmark: "Burn multiple (net burn ÷ net new ARR) below 1.5× is considered efficient. Below 1× is exceptional.",
    redFlag: "Burn that's rising faster than revenue is a compounding problem. Audit monthly expenses for anything that doesn't directly drive growth.",
    calculator: {
      inputs: [
        { id: "expenses", label: "Monthly expenses ($)", placeholder: "120000", prefix: "$" },
        { id: "revenue", label: "Monthly revenue ($)", placeholder: "40000", prefix: "$" },
      ],
      compute: (v) => [
        { label: "Net burn / month", value: `$${Math.max(0, (v.expenses ?? 0) - (v.revenue ?? 0)).toLocaleString()}` },
        { label: "Gross burn / month", value: `$${(v.expenses ?? 0).toLocaleString()}` },
      ],
    },
  },
  {
    id: "runway",
    term: "Runway",
    acronym: undefined,
    category: "Financials",
    definition: "The number of months the company can operate before running out of cash, at the current burn rate.",
    whyMatters: "Runway determines your negotiating position in fundraising. Raising with 3 months of runway is desperate; raising with 18+ months is powerful.",
    formula: "Runway (months) = Cash on Hand ÷ Net Monthly Burn",
    example: "Cash: $1.5M, net burn: $75K/month. Runway = $1.5M ÷ $75K = 20 months.",
    goodBenchmark: "Start a fundraise with 12–18 months of runway. Never go below 6 months without a clear plan.",
    redFlag: "Runway under 6 months without a clear fundraising or profitability path is a crisis. Begin fundraising at 12 months.",
    calculator: {
      inputs: [
        { id: "cash", label: "Cash on hand ($)", placeholder: "1500000", prefix: "$" },
        { id: "net_burn", label: "Net monthly burn ($)", placeholder: "75000", prefix: "$" },
      ],
      compute: (v) => {
        const months = v.net_burn > 0 ? Math.floor((v.cash ?? 0) / v.net_burn) : 0;
        const d = new Date();
        d.setMonth(d.getMonth() + months);
        return [
          { label: "Runway", value: `${months} months` },
          { label: "Cash-out date", value: months > 0 ? d.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—" },
        ];
      },
    },
  },
  {
    id: "gross_margin",
    term: "Gross Margin",
    acronym: "GM",
    category: "Financials",
    definition: "Revenue minus cost of goods sold (COGS), expressed as a percentage. COGS for SaaS includes hosting, support, and customer success — not R&D or sales.",
    whyMatters: "Gross margin determines how much of each dollar of revenue you can reinvest in growth. High-margin businesses compound faster.",
    formula: "Gross Margin = (Revenue − COGS) ÷ Revenue × 100",
    example: "$100K revenue, $25K COGS. Gross margin = ($100K − $25K) ÷ $100K = 75%.",
    goodBenchmark: "SaaS gross margins of 70–80%+ are standard. < 60% raises questions about your cost structure.",
    redFlag: "Falling gross margins as you scale suggest your COGS is not following the software model — often a services-heavy delivery problem.",
    calculator: {
      inputs: [
        { id: "revenue", label: "Revenue ($)", placeholder: "100000", prefix: "$" },
        { id: "cogs", label: "COGS ($)", placeholder: "25000", prefix: "$" },
      ],
      compute: (v) => {
        const gm = v.revenue > 0 ? (((v.revenue ?? 0) - (v.cogs ?? 0)) / v.revenue) * 100 : 0;
        return [{ label: "Gross margin", value: `${gm.toFixed(1)}%` }];
      },
    },
  },
  {
    id: "payback",
    term: "CAC Payback Period",
    acronym: undefined,
    category: "Unit economics",
    definition: "The number of months it takes to recover the cost of acquiring a customer from the gross profit that customer generates.",
    whyMatters: "Shorter payback = faster capital recycling. A 6-month payback means you can deploy each dollar of sales investment twice a year.",
    formula: "Payback Period = CAC ÷ (MRR × Gross Margin %)",
    example: "CAC $1,200, MRR per customer $500, gross margin 70%. Payback = $1,200 ÷ ($500 × 0.70) = 3.4 months.",
    goodBenchmark: "< 12 months is good for B2B SaaS. < 6 months is excellent. > 18 months starts to stress the business model.",
    redFlag: "Payback periods lengthening over time suggest rising CAC without corresponding ACV growth.",
    calculator: {
      inputs: [
        { id: "cac", label: "CAC ($)", placeholder: "1200", prefix: "$" },
        { id: "mrr_per", label: "MRR per customer ($)", placeholder: "500", prefix: "$" },
        { id: "gm_pct", label: "Gross margin (%)", placeholder: "70", suffix: "%" },
      ],
      compute: (v) => {
        const monthly_gp = (v.mrr_per ?? 0) * ((v.gm_pct ?? 0) / 100);
        const payback = monthly_gp > 0 ? (v.cac ?? 0) / monthly_gp : 0;
        return [{ label: "Payback period", value: payback > 0 ? `${payback.toFixed(1)} months` : "—" }];
      },
    },
  },
  {
    id: "growth_rate",
    term: "Month-over-Month Growth Rate",
    acronym: "MoM",
    category: "Growth",
    definition: "The percentage increase in a metric (usually MRR or ARR) from one month to the next.",
    whyMatters: "MoM growth rate compounds. 10% MoM = 214% annual growth. 5% MoM = 80% annual. Small differences in monthly rate create massive differences in outcome.",
    formula: "MoM Growth = (Current Month − Prior Month) ÷ Prior Month × 100",
    example: "MRR grew from $80K to $96K. MoM growth = ($96K − $80K) ÷ $80K = 20%.",
    goodBenchmark: "T2D3 (triple, triple, double, double, double) is the classic Series A → B benchmark. 15–20% MoM is strong at seed.",
    redFlag: "Declining MoM growth rate is a leading indicator of trouble — address it before it becomes obvious in ARR.",
    calculator: {
      inputs: [
        { id: "prior", label: "Prior month MRR ($)", placeholder: "80000", prefix: "$" },
        { id: "current", label: "Current month MRR ($)", placeholder: "96000", prefix: "$" },
      ],
      compute: (v) => {
        const mom = v.prior > 0 ? (((v.current ?? 0) - v.prior) / v.prior) * 100 : 0;
        const annual = Math.pow(1 + mom / 100, 12) - 1;
        return [
          { label: "MoM growth", value: `${mom.toFixed(1)}%` },
          { label: "Implied annual growth", value: `${(annual * 100).toFixed(0)}%` },
        ];
      },
    },
  },
];

const CATEGORIES: KPICategory[] = ["Revenue", "Retention", "Unit economics", "Financials", "Growth"];

const CATEGORY_COLORS: Record<KPICategory, string> = {
  Revenue: "#534AB7",
  Retention: "#059669",
  "Unit economics": "#d97706",
  Financials: "#0ea5e9",
  Growth: "#dc2626",
};

// ---------------------------------------------------------------------------
// Calculator
// ---------------------------------------------------------------------------

function KPICalculator({ kpi }: { kpi: KPIEntry }) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const calc = kpi.calculator;
  if (!calc) return null;

  const numericInputs = Object.fromEntries(
    Object.entries(inputs).map(([k, v]) => [k, parseFloat(v.replace(/,/g, "")) || 0])
  );
  const results = calc.compute(numericInputs);

  return (
    <div className="mt-3 rounded-lg border border-indigo-100 bg-[#FAFAFF] p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#534AB7" }}>Calculator</p>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        {calc.inputs.map((inp) => (
          <div key={inp.id}>
            <label className="mb-1 block text-[10px] font-medium text-slate-500">{inp.label}</label>
            <div className="flex items-center rounded-lg border border-slate-200 bg-white">
              {inp.prefix ? <span className="pl-2 text-xs text-slate-400">{inp.prefix}</span> : null}
              <input
                type="number"
                value={inputs[inp.id] ?? ""}
                onChange={(e) => setInputs((prev) => ({ ...prev, [inp.id]: e.target.value }))}
                placeholder={inp.placeholder}
                className="w-full rounded-lg px-2 py-1.5 text-xs outline-none"
              />
              {inp.suffix ? <span className="pr-2 text-xs text-slate-400">{inp.suffix}</span> : null}
            </div>
          </div>
        ))}
      </div>
      {results.some((r) => r.value !== "—") ? (
        <div className="flex flex-wrap gap-3">
          {results.map((r, i) => (
            <div key={i} className="rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-indigo-100">
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">{r.label}</p>
              <p className="text-base font-bold" style={{ color: "#534AB7" }}>{r.value}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KPICard({ kpi }: { kpi: KPIEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"definition" | "calculator">("definition");
  const color = CATEGORY_COLORS[kpi.category];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((o) => !o)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {kpi.acronym ? (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${color}15`, color }}>
                {kpi.acronym}
              </span>
            ) : null}
            <p className="text-sm font-semibold text-slate-900">{kpi.term}</p>
            <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em]" style={{ background: "#F1F5F9", color: "#64748b" }}>
              {kpi.category}
            </span>
          </div>
          {!expanded ? <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{kpi.definition}</p> : null}
        </div>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"
          className="mt-1 shrink-0 transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
          <path d="M6 9l6 6 6-6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded ? (
        <div className="border-t border-slate-100">
          {kpi.calculator ? (
            <div className="flex border-b border-slate-100">
              {(["definition", "calculator"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className="flex-1 py-2 text-[11px] font-semibold capitalize transition"
                  style={{
                    color: tab === t ? "#534AB7" : "#94a3b8",
                    borderBottom: tab === t ? `2px solid #534AB7` : "2px solid transparent",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : null}

          <div className="px-4 py-3 space-y-3">
            {tab === "definition" || !kpi.calculator ? (
              <>
                <p className="text-xs leading-relaxed text-slate-700">{kpi.definition}</p>

                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Formula</p>
                  <p className="font-mono text-[11px] text-slate-700">{kpi.formula}</p>
                </div>

                <div>
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Example</p>
                  <p className="text-[11px] leading-relaxed text-slate-600">{kpi.example}</p>
                </div>

                <div>
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Why it matters</p>
                  <p className="text-[11px] leading-relaxed text-slate-600">{kpi.whyMatters}</p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-emerald-50 px-3 py-2 ring-1 ring-emerald-100">
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">Good benchmark</p>
                    <p className="text-[11px] leading-relaxed text-emerald-800">{kpi.goodBenchmark}</p>
                  </div>
                  <div className="rounded-lg bg-red-50 px-3 py-2 ring-1 ring-red-100">
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-red-700">Red flag</p>
                    <p className="text-[11px] leading-relaxed text-red-800">{kpi.redFlag}</p>
                  </div>
                </div>
              </>
            ) : (
              <KPICalculator kpi={kpi} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FounderKPIGlossary() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<KPICategory | null>(null);

  const filtered = useMemo(() => {
    return KPI_DATA.filter((kpi) => {
      const matchSearch = !search || [kpi.term, kpi.acronym ?? "", kpi.definition].some((s) =>
        s.toLowerCase().includes(search.toLowerCase())
      );
      const matchCat = !activeCategory || kpi.category === activeCategory;
      return matchSearch && matchCat;
    });
  }, [search, activeCategory]);

  return (
    <div className="space-y-5">
      {/* Intro */}
      <div className="rounded-xl border border-indigo-100 bg-[#FAFAFF] px-4 py-3">
        <p className="text-xs font-semibold" style={{ color: "#534AB7" }}>How to use this</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
          Every definition includes a formula, a real example, good benchmarks, and a red flag to watch for. Open the Calculator tab on any metric to compute your own numbers.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="#94a3b8" strokeWidth="2" />
          <path d="M16.5 16.5L21 21" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search metrics…"
          className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            className="rounded-full px-3 py-1 text-[11px] font-semibold transition"
            style={{
              background: activeCategory === cat ? CATEGORY_COLORS[cat] : "#F1F5F9",
              color: activeCategory === cat ? "white" : "#475569",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-slate-400">{filtered.length} metric{filtered.length !== 1 ? "s" : ""}</p>

      <div className="space-y-3">
        {filtered.map((kpi) => <KPICard key={kpi.id} kpi={kpi} />)}
      </div>
    </div>
  );
}
