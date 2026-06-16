"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Types & data
// ---------------------------------------------------------------------------

type DDCategory = {
  id: string;
  label: string;
  description: string;
  items: DDItem[];
};

type DDItem = {
  id: string;
  title: string;
  detail: string;
  whoAsks: string;
  format: string;
  urgency: "always" | "often" | "sometimes";
};

const DD_CATEGORIES: DDCategory[] = [
  {
    id: "corporate",
    label: "Corporate & legal",
    description: "Foundation documents that prove your company is properly formed and clean to invest into.",
    items: [
      { id: "corp-1", title: "Certificate of incorporation", detail: "Certified copy of your certificate or articles of incorporation from your state of formation (usually Delaware).", whoAsks: "All institutional investors", format: "PDF", urgency: "always" },
      { id: "corp-2", title: "Cap table (409A-ready)", detail: "Full capitalisation table showing all shareholders, option holders, warrants, and SAFEs with current ownership percentages. Must be up to date.", whoAsks: "All institutional investors", format: "Spreadsheet or Carta export", urgency: "always" },
      { id: "corp-3", title: "Shareholders agreement", detail: "Current version of your shareholders or stockholders agreement, including any side letters.", whoAsks: "All institutional investors", format: "PDF", urgency: "always" },
      { id: "corp-4", title: "SAFE / convertible note documents", detail: "All outstanding convertible instruments with cap, discount, and MFN clause details.", whoAsks: "All investors if you've raised before", format: "PDF", urgency: "always" },
      { id: "corp-5", title: "Option plan & grant schedule", detail: "Equity incentive plan plus individual grant agreements for all option holders.", whoAsks: "Most institutional investors", format: "PDF + spreadsheet", urgency: "often" },
      { id: "corp-6", title: "Board meeting minutes", detail: "Minutes from last 12 months of board meetings, including any written consent resolutions.", whoAsks: "Institutional VCs at Series A+", format: "PDF", urgency: "often" },
      { id: "corp-7", title: "Good standing certificate", detail: "Proof your company is in good standing in its state of formation.", whoAsks: "Most institutional investors", format: "Official document", urgency: "often" },
    ],
  },
  {
    id: "financials",
    label: "Financial statements",
    description: "Historical performance and forward-looking model — investors will stress-test your assumptions.",
    items: [
      { id: "fin-1", title: "Last 12 months P&L", detail: "Income statement for the trailing 12 months (or since founding if less than a year). Should show revenue, COGS, gross margin, and operating expenses by category.", whoAsks: "All institutional investors", format: "Spreadsheet or accounting export", urgency: "always" },
      { id: "fin-2", title: "Balance sheet", detail: "Current balance sheet showing cash, receivables, liabilities, and equity.", whoAsks: "All institutional investors", format: "Spreadsheet or accounting export", urgency: "always" },
      { id: "fin-3", title: "3-year financial model", detail: "Forward-looking model with monthly granularity for Year 1 and annual for Years 2–3. Show your key drivers and assumptions clearly.", whoAsks: "All institutional investors", format: "Spreadsheet", urgency: "always" },
      { id: "fin-4", title: "MRR / ARR breakdown", detail: "Monthly recurring revenue broken down by customer, with new, expansion, and churned MRR clearly labelled.", whoAsks: "SaaS-focused investors", format: "Spreadsheet", urgency: "always" },
      { id: "fin-5", title: "Cash flow statement", detail: "Operating, investing, and financing cash flows. Important for showing runway clarity.", whoAsks: "Most institutional investors", format: "Spreadsheet or accounting export", urgency: "often" },
      { id: "fin-6", title: "Audited financials (if applicable)", detail: "Audited financial statements from an independent CPA. Usually required for Series B+.", whoAsks: "Later-stage institutional investors", format: "PDF from auditor", urgency: "sometimes" },
      { id: "fin-7", title: "Unit economics model", detail: "CAC, LTV, payback period, gross margin — built bottoms-up with source data.", whoAsks: "Growth-stage VCs", format: "Spreadsheet", urgency: "often" },
    ],
  },
  {
    id: "product",
    label: "Product & technology",
    description: "Proof that you've built something real and that there are no technical or IP landmines.",
    items: [
      { id: "prod-1", title: "Product demo or sandbox access", detail: "A working demo environment investors can explore. Nothing builds confidence faster than seeing the product work.", whoAsks: "All investors", format: "Link or demo video", urgency: "always" },
      { id: "prod-2", title: "Technical architecture overview", detail: "1–2 page summary of your technical stack, infrastructure, and key architectural decisions. Not a deep technical spec.", whoAsks: "Technical VCs and most institutional funds", format: "PDF or slide", urgency: "often" },
      { id: "prod-3", title: "IP ownership documentation", detail: "Assignment of inventions agreements from all employees and contractors who contributed to the product.", whoAsks: "Most institutional investors", format: "PDF", urgency: "always" },
      { id: "prod-4", title: "Patent filings (if any)", detail: "Pending or granted patents with filing dates and claims summary.", whoAsks: "Deep tech investors", format: "PDF", urgency: "sometimes" },
      { id: "prod-5", title: "Security practices overview", detail: "Summary of how you handle data security, compliance (SOC 2, GDPR, HIPAA if relevant), and penetration testing.", whoAsks: "Enterprise-focused investors", format: "PDF or narrative", urgency: "often" },
      { id: "prod-6", title: "Third-party API / vendor dependencies", detail: "Key integrations and vendors your product depends on, with any concentration risks noted.", whoAsks: "Technical investors at Series A+", format: "List", urgency: "sometimes" },
    ],
  },
  {
    id: "customers",
    label: "Customers & revenue",
    description: "Evidence that real people pay you and stay — the most de-risking data set available.",
    items: [
      { id: "cust-1", title: "Customer list with ARR/MRR per account", detail: "Full list of paying customers with ARR per account. Can be anonymised with size bucket labels if NDAs require it.", whoAsks: "All institutional investors", format: "Spreadsheet", urgency: "always" },
      { id: "cust-2", title: "Churn analysis (last 12 months)", detail: "Monthly gross and net churn, with reasons for churned customers clearly noted.", whoAsks: "All institutional investors", format: "Spreadsheet", urgency: "always" },
      { id: "cust-3", title: "Logo customer references", detail: "2–3 customers willing to speak with investors on your behalf. Warm references close deals.", whoAsks: "All institutional investors at offer stage", format: "Names and contact info", urgency: "always" },
      { id: "cust-4", title: "Sample customer contracts", detail: "Representative MSA or subscription agreement showing contract length, price, and key terms. Redact sensitive commercial terms if needed.", whoAsks: "Most institutional investors", format: "PDF", urgency: "often" },
      { id: "cust-5", title: "Sales pipeline report", detail: "Current sales pipeline broken down by stage, value, and expected close date.", whoAsks: "Growth investors", format: "CRM export or spreadsheet", urgency: "often" },
      { id: "cust-6", title: "NPS or CSAT data", detail: "Customer satisfaction scores with methodology, sample size, and trend over time.", whoAsks: "Consumer-focused investors", format: "Report or summary", urgency: "sometimes" },
    ],
  },
  {
    id: "team",
    label: "Team & HR",
    description: "Investors back people first — demonstrate that your team is properly structured and committed.",
    items: [
      { id: "team-1", title: "Founder and key employee bios", detail: "LinkedIn profiles or 1-page bios for all founders and C-level hires, emphasising domain expertise and relevant experience.", whoAsks: "All investors", format: "PDF or links", urgency: "always" },
      { id: "team-2", title: "Founder vesting schedules", detail: "Current vesting terms for all founders, including cliff dates and any acceleration provisions.", whoAsks: "All institutional investors", format: "Term summary or agreement", urgency: "always" },
      { id: "team-3", title: "Employee agreements (template)", detail: "Template offer letter and PIIA (Proprietary Information and Inventions Agreement) you use for all new hires.", whoAsks: "Most institutional investors", format: "PDF", urgency: "often" },
      { id: "team-4", title: "Org chart", detail: "Current org chart showing reporting structure, headcount by department, and open roles.", whoAsks: "Most investors", format: "Diagram or PDF", urgency: "often" },
      { id: "team-5", title: "Hiring plan (12 months)", detail: "Planned hires with titles, estimated start date, and salary bands.", whoAsks: "Growth investors", format: "Spreadsheet", urgency: "often" },
      { id: "team-6", title: "Contractor and advisor agreements", detail: "Agreements with key contractors and advisors, especially those who worked on the product.", whoAsks: "Diligence counsel", format: "PDF", urgency: "sometimes" },
    ],
  },
  {
    id: "market",
    label: "Market & competitive",
    description: "Evidence that the market is large, growing, and that you have a defensible position in it.",
    items: [
      { id: "mkt-1", title: "Market sizing analysis", detail: "TAM / SAM / SOM breakdown with sources. Bottoms-up analysis (how many buyers × deal size) is more credible than citing a Gartner report alone.", whoAsks: "All institutional investors", format: "Slide or PDF", urgency: "always" },
      { id: "mkt-2", title: "Competitive landscape matrix", detail: "Comparison of your product against 3–5 direct competitors across key dimensions — be honest about where others are strong.", whoAsks: "All institutional investors", format: "Slide or spreadsheet", urgency: "always" },
      { id: "mkt-3", title: "Key partnerships or LOIs", detail: "Letters of intent, distribution agreements, or strategic partnerships — especially if they signal market access.", whoAsks: "Growth investors", format: "PDF or summary", urgency: "sometimes" },
      { id: "mkt-4", title: "Industry analyst coverage", detail: "Any third-party reports, analyst coverage, or press that validates the market or your position in it.", whoAsks: "Enterprise-focused investors", format: "Links or PDFs", urgency: "sometimes" },
    ],
  },
  {
    id: "compliance",
    label: "Regulatory & compliance",
    description: "Anything that could create unexpected liability — investors always look for landmines here.",
    items: [
      { id: "comp-1", title: "Litigation disclosure", detail: "List of any pending, threatened, or settled lawsuits or regulatory actions. 'None' is fine — just confirm it in writing.", whoAsks: "All institutional investors", format: "Written statement or summary", urgency: "always" },
      { id: "comp-2", title: "Data privacy policy", detail: "Your public-facing privacy policy and any internal data handling procedures (especially for GDPR or CCPA compliance).", whoAsks: "Consumer and B2B investors", format: "Link or PDF", urgency: "often" },
      { id: "comp-3", title: "Industry-specific licenses", detail: "Any regulatory licenses or registrations required to operate in your industry (e.g. financial services, healthcare, food).", whoAsks: "Regulated industry investors", format: "Copies of licenses", urgency: "sometimes" },
      { id: "comp-4", title: "Insurance certificates", detail: "D&O insurance, general liability, and any professional indemnity policies.", whoAsks: "Late-stage VCs and family offices", format: "Certificates", urgency: "sometimes" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const URGENCY_STYLES = {
  always: { bg: "#FEF2F2", text: "#991B1B", label: "Always requested" },
  often: { bg: "#FFF7ED", text: "#92400E", label: "Often requested" },
  sometimes: { bg: "#F0FDF4", text: "#14532D", label: "Sometimes requested" },
};

function ItemRow({
  item, checked, onToggle,
}: {
  item: DDItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const u = URGENCY_STYLES[item.urgency];

  return (
    <div className={`rounded-lg border transition ${checked ? "border-emerald-200 bg-emerald-50" : "border-slate-100 bg-white"}`}>
      <div className="flex items-start gap-3 px-3 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${checked ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white"}`}
          aria-label={checked ? "Mark incomplete" : "Mark complete"}
        >
          {checked ? (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className={`text-sm font-medium ${checked ? "text-emerald-800 line-through" : "text-slate-800"}`}>
              {item.title}
            </p>
            <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em]" style={{ background: u.bg, color: u.text }}>
              {u.label}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-500">Format: {item.format}</p>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((o) => !o)}
          className="shrink-0 mt-0.5"
          aria-label="Show details"
        >
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"
            className="transition-transform"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <path d="M6 9l6 6 6-6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {expanded ? (
        <div className="border-t border-slate-100 px-3 py-2.5">
          <p className="mb-1 text-[11px] leading-relaxed text-slate-600">{item.detail}</p>
          <p className="text-[10px] text-slate-400"><span className="font-semibold text-slate-500">Who asks: </span>{item.whoAsks}</p>
        </div>
      ) : null}
    </div>
  );
}

function CategorySection({
  category, checkedIds, onToggle,
}: {
  category: DDCategory;
  checkedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const done = category.items.filter((i) => checkedIds.has(i.id)).length;
  const total = category.items.length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-semibold text-slate-900">{category.label}</p>
            <span className="text-[10px] text-slate-400">{done}/{total}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, background: pct === 100 ? "#059669" : "#534AB7" }}
            />
          </div>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"
          className="shrink-0 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path d="M6 9l6 6 6-6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div className="border-t border-slate-100 px-4 py-3 space-y-2">
          <p className="text-[11px] leading-relaxed text-slate-500 mb-3">{category.description}</p>
          {category.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              checked={checkedIds.has(item.id)}
              onToggle={() => onToggle(item.id)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DueDiligenceChecklist() {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [filterUrgency, setFilterUrgency] = useState<"all" | "always" | "often">("always");

  function toggle(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allItems = DD_CATEGORIES.flatMap((c) => c.items);
  const alwaysItems = allItems.filter((i) => i.urgency === "always");
  const totalDone = allItems.filter((i) => checkedIds.has(i.id)).length;
  const alwaysDone = alwaysItems.filter((i) => checkedIds.has(i.id)).length;

  const filteredCategories = DD_CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.items.filter((item) => {
      if (filterUrgency === "always") return item.urgency === "always";
      if (filterUrgency === "often") return item.urgency === "always" || item.urgency === "often";
      return true;
    }),
  })).filter((cat) => cat.items.length > 0);

  return (
    <div className="space-y-5">
      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm">
          <p className="text-xl font-bold" style={{ color: "#534AB7" }}>{alwaysDone}/{alwaysItems.length}</p>
          <p className="text-[10px] text-slate-500">Critical items ready</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm">
          <p className="text-xl font-bold" style={{ color: "#059669" }}>{totalDone}</p>
          <p className="text-[10px] text-slate-500">Total items done</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm">
          <p className="text-xl font-bold" style={{ color: "#d97706" }}>{allItems.length - totalDone}</p>
          <p className="text-[10px] text-slate-500">Remaining</p>
        </div>
      </div>

      {/* Intro */}
      <div className="rounded-xl border border-indigo-100 bg-[#FAFAFF] px-4 py-3">
        <p className="text-xs font-semibold" style={{ color: "#534AB7" }}>What this covers</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
          This checklist covers what institutional investors — VCs, family offices, and angels writing $500K+ — typically request during diligence. Start with &quot;Always requested&quot; items before your first LP meeting.
        </p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-semibold text-slate-500">Show:</p>
        {[
          { key: "always", label: "Critical only" },
          { key: "often", label: "Critical + common" },
          { key: "all", label: "All items" },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilterUrgency(key as "all" | "always" | "often")}
            className="rounded-full px-3 py-1 text-[11px] font-semibold transition"
            style={{
              background: filterUrgency === key ? "#534AB7" : "#F1F5F9",
              color: filterUrgency === key ? "white" : "#475569",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Category sections */}
      <div className="space-y-4">
        {filteredCategories.map((cat) => (
          <CategorySection
            key={cat.id}
            category={cat}
            checkedIds={checkedIds}
            onToggle={toggle}
          />
        ))}
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] leading-relaxed text-slate-500">
        <span className="font-semibold text-slate-600">Note: </span>
        Every investor and deal is different. This checklist reflects common institutional expectations but is not legal advice. Work with your counsel to determine what's appropriate to share at each stage of your process.
      </div>
    </div>
  );
}
