"use client";

import { useState, useMemo, useEffect } from "react";
import { useToolkitSave, ToolkitSaveStatus } from "@/hooks/useToolkitSave";

function SaveChip({ status }: { status: ToolkitSaveStatus }) {
  if (status === "idle") return null;
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    saving: { bg: "#F1F5F9", text: "#64748b", label: "Saving…" },
    saved:  { bg: "#F0FDF4", text: "#15803D", label: "Saved" },
    error:  { bg: "#FEF2F2", text: "#DC2626", label: "Save failed" },
  };
  const s = styles[status];
  if (!s) return null;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: s.bg, color: s.text }}>
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Clause library
// ---------------------------------------------------------------------------

type RiskLevel = "low" | "medium" | "high";

type Clause = {
  id: string;
  category: string;
  term: string;
  plainEnglish: string;
  example: string;
  redFlags: string[];
  negotiationTips: string[];
  founderFriendly: string;
  risk: RiskLevel;
};

const CLAUSES: Clause[] = [
  // Valuation & economics
  {
    id: "pre_money_valuation",
    category: "Valuation",
    term: "Pre-money valuation",
    plainEnglish: "The agreed value of your company before the new investment is added. If your pre-money is $5M and you raise $1M, post-money is $6M and investors own 1/6 = 16.7%.",
    example: "Pre-money valuation: $5,000,000. Investment: $1,000,000. Post-money: $6,000,000.",
    redFlags: ["Valuation significantly below comparable companies in your stage", "Cap table not clearly defined before valuation is set"],
    negotiationTips: ["Benchmark against recent comparable raises (Crunchbase, PitchBook)", "Pre-money option pool expansion reduces your effective valuation — negotiate post-money pool where possible", "Push for a post-money SAFE to avoid valuation ambiguity"],
    founderFriendly: "Higher pre-money = less dilution. Aim to anchor on post-money SAFE if stage allows.",
    risk: "medium",
  },
  {
    id: "liquidation_preference",
    category: "Economics",
    term: "Liquidation preference",
    plainEnglish: "How much investors get paid back before founders see any proceeds in a sale or wind-down. A 1x non-participating preferred means investors get their money back first. Participating preferred means they get their money back PLUS share in the remaining proceeds.",
    example: "1x non-participating: investor gets $1M back from a $3M exit, founders split the remaining $2M. Participating: investor gets $1M + their percentage of the remaining $2M.",
    redFlags: ["2x or 3x liquidation preference (investor gets 2-3× their money before you see anything)", "Participating preferred with no cap — investors double-dip on every dollar", "Multiple liquidation stacks from previous rounds that compound"],
    negotiationTips: ["Push hard for 1x non-participating — it's the standard at Seed and Series A", "If they insist on participating, negotiate a participation cap (e.g. 3x return, then converts to common)", "Multiple liquidation stacks become deal-killers for future investors — minimise early"],
    founderFriendly: "1x non-participating preferred is founder-friendly. Anything else is a red flag worth negotiating.",
    risk: "high",
  },
  {
    id: "anti_dilution",
    category: "Economics",
    term: "Anti-dilution protection",
    plainEnglish: "If you raise a future round at a lower valuation (a 'down round'), anti-dilution adjusts investor share counts upward to protect their ownership percentage. Full ratchet is worst for founders. Broad-based weighted average is standard.",
    example: "Series A investor owns 20% at $10M valuation. If you raise Series B at $5M (down round): full ratchet gives them back to 20% by issuing new shares at your expense. Broad-based WA adjusts more gently.",
    redFlags: ["Full ratchet anti-dilution — extremely founder-unfriendly, can wipe out founder equity in a down round", "No carve-outs for employee option grants, debt conversions, or other standard exclusions"],
    negotiationTips: ["Insist on broad-based weighted average — it's the market standard", "Negotiate standard carve-outs: employee options, equipment loans, convertible notes", "Avoid full ratchet at all costs — very few institutional investors require it"],
    founderFriendly: "Broad-based weighted average is acceptable. Full ratchet is a non-starter.",
    risk: "high",
  },
  {
    id: "pro_rata",
    category: "Economics",
    term: "Pro-rata rights",
    plainEnglish: "The right for investors to maintain their ownership percentage in future rounds by investing their proportional share. 'Super pro-rata' lets them invest more than their percentage to increase ownership.",
    example: "Investor owns 15%. Pro-rata lets them put in 15% of the next round to stay at 15%. Super pro-rata might let them invest 30% of the next round.",
    redFlags: ["Super pro-rata rights — can crowd out new investors in future rounds", "Pro-rata that applies to all future rounds with no sunset — creates complexity at scale"],
    negotiationTips: ["Standard pro-rata is fine and expected by institutional investors", "Limit super pro-rata or sunset after Series B", "Major investor pro-rata rights are less problematic than minor investor rights — differentiate by check size"],
    founderFriendly: "Standard pro-rata is fine. Super pro-rata should be resisted or capped.",
    risk: "medium",
  },
  // Governance
  {
    id: "board_composition",
    category: "Governance",
    term: "Board composition",
    plainEnglish: "Who sits on your board and how many votes each seat carries. A typical Seed board is 2 founders + 1 investor (3 seats). Series A often goes to 2 founders + 2 investors + 1 independent (5 seats). Whoever controls the board controls the company.",
    example: "Board: 2 founder seats, 1 lead investor seat, 1 independent seat elected by common shareholders. Founders control 3:2 on most votes.",
    redFlags: ["Investor-controlled board at Seed — giving up control before you've proved the business", "Investor veto on key hires (CEO, CFO, CTO) without board approval", "No independent director seat or investors control who fills it"],
    negotiationTips: ["Maintain board control through at least Series A — you should have founder majority", "Negotiate that CEO is a board member by title, not just by founder seat", "Define exactly what requires board approval vs. what is management's prerogative"],
    founderFriendly: "Founders should control the board until at least Series B.",
    risk: "high",
  },
  {
    id: "protective_provisions",
    category: "Governance",
    term: "Protective provisions (veto rights)",
    plainEnglish: "A list of company actions that require investor approval even if founders control the board. Common: selling the company, issuing new shares, taking on debt, changing certificate of incorporation.",
    example: "Investor approval required for: (a) sale of the company, (b) issuing shares above Series A liquidation preference, (c) debt exceeding $500K.",
    redFlags: ["Veto rights on day-to-day operations (hiring above $X salary)", "Any new round requires existing investor consent — this can block financing", "Veto over product decisions or strategic pivots"],
    negotiationTips: ["Standard protective provisions on capital structure and M&A are fine", "Push back on operational vetoes — they create friction without protecting investor interests", "Define dollar thresholds clearly to avoid ambiguity about what triggers approval"],
    founderFriendly: "Standard M&A and capital structure vetoes are acceptable. Operational vetoes are not.",
    risk: "medium",
  },
  {
    id: "drag_along",
    category: "Governance",
    term: "Drag-along rights",
    plainEnglish: "If a majority of investors (or a specific threshold) vote to sell the company, they can 'drag' the remaining shareholders — including founders — along, forcing them to sell too.",
    example: "If investors holding 60%+ of preferred shares vote to sell at $10M, all shareholders (including founders who own common) must sell at $10M.",
    redFlags: ["Low drag-along threshold — e.g. single investor or simple majority of preferred can force a sale", "Drag-along can be triggered at any price (even below liquidation preference)", "No founder consent required to initiate a drag-along sale"],
    negotiationTips: ["Negotiate that drag-along requires consent of a majority of common shareholders (i.e. founders have a say)", "Set a minimum price floor that must be met before drag-along can be triggered", "Require board approval in addition to investor vote threshold"],
    founderFriendly: "Require common majority consent. Never allow a single investor to trigger drag-along alone.",
    risk: "high",
  },
  {
    id: "info_rights",
    category: "Governance",
    term: "Information rights",
    plainEnglish: "Investors' right to receive financial updates — monthly, quarterly, or annual financials, plus board meeting minutes. Major investors often have the right to inspect company books and visit the company.",
    example: "Monthly: unaudited P&L, cash balance, key metrics. Quarterly: full financial statements. Annual: audited financials within 90 days of year-end.",
    redFlags: ["Information rights granted to small investors (creates administrative burden with many small investors)", "Audited financials required annually from day 1 — expensive for early-stage companies"],
    negotiationTips: ["Grant full info rights to major investors (e.g. investors above $500K)", "Limit minor investor rights to annual summary report", "Consider building a standard investor update template so reporting is consistent and efficient"],
    founderFriendly: "Tiered info rights by check size is the right approach.",
    risk: "low",
  },
  // Founder-specific
  {
    id: "vesting",
    category: "Founder terms",
    term: "Founder vesting / reverse vesting",
    plainEnglish: "If founders already own their shares, investors may require 'reverse vesting' — shares you already hold become subject to a vesting schedule, so if you leave early, unvested shares go back to the company. Typically 4 years with 1-year cliff.",
    example: "Founder holds 4M shares. On investment, all shares are subject to 4-year reverse vesting. If founder leaves after 18 months, they keep only 37.5% (18/48 months), rest returned to company.",
    redFlags: ["No cliff credit for time already worked before financing — you should get credit for founding period", "Single trigger acceleration — one event (termination) can accelerate vesting, creating cliff risks", "Vesting applies to both co-founders unequally"],
    negotiationTips: ["Negotiate credit for time worked — at least 1 year of cliff immediately upon close", "Double-trigger acceleration (termination + change of control) is standard and protects you", "Ensure all co-founders are on equivalent schedules to avoid future disputes"],
    founderFriendly: "Insist on credit for founding period. Double-trigger acceleration is non-negotiable.",
    risk: "high",
  },
  {
    id: "no_shop",
    category: "Process",
    term: "No-shop / exclusivity",
    plainEnglish: "During due diligence, you agree not to talk to other investors for a set period (usually 30–60 days). If the deal falls through, you've lost that time and potentially signalled to the market that you were 'passed on'.",
    example: "For 45 days following execution of this term sheet, the Company agrees not to solicit, encourage, or enter discussions with any other potential investors.",
    redFlags: ["No-shop periods exceeding 60 days — too long, especially at early stage", "No-shop with no carve-out for existing investors or material developments", "No-shop that doesn't automatically terminate if investor fails to close on schedule"],
    negotiationTips: ["Limit no-shop to 30 days at Seed, 45 days at Series A", "Include automatic termination if investor misses diligence milestones", "Negotiate carve-outs for existing investors asking to participate"],
    founderFriendly: "Keep no-shop short (30 days) and ensure it terminates automatically if investor delays.",
    risk: "medium",
  },
  {
    id: "pay_to_play",
    category: "Economics",
    term: "Pay-to-play",
    plainEnglish: "Existing investors must participate in future rounds pro-rata or lose their preferred stock rights (converting to common). This is designed to ensure existing investors support the company in difficult future rounds.",
    example: "If Series A investor doesn't participate in Series B at their pro-rata, their preferred shares automatically convert to common, losing liquidation preference and other preferred rights.",
    redFlags: ["Pay-to-play that applies to the investor proposing this term — they may not plan to follow on", "Ambiguous definition of what counts as 'participation'"],
    negotiationTips: ["Pay-to-play can be founder-friendly if future investors are requiring it — it disciplines existing investors", "Ensure the definition of participation is clear: full pro-rata, or proportional to available allocation", "If an investor proposes pay-to-play, check whether they have a follow-on fund to participate from"],
    founderFriendly: "Can be founder-friendly — forces existing investors to support future rounds.",
    risk: "low",
  },
  {
    id: "redemption_rights",
    category: "Economics",
    term: "Redemption rights",
    plainEnglish: "The right for investors to demand their money back after a set period (usually 5 years) if there's been no liquidity event. Can force a company sale or create financial distress.",
    example: "After 5 years, preferred holders may demand redemption at original purchase price plus 8% annual interest, payable over 3 years.",
    redFlags: ["Redemption rights with interest above 8% per annum", "Redemption period shorter than 5 years from closing", "No board approval required to trigger redemption"],
    negotiationTips: ["Resist redemption rights at Seed and Series A — they're unusual and create exit pressure", "If you must accept them, push for 7-year trigger and board approval requirement", "Most top-tier VCs do not require redemption rights — it's a sign of a less institutional investor"],
    founderFriendly: "Resist redemption rights entirely at early stage. They're a red flag.",
    risk: "high",
  },
];

const CATEGORIES = [...new Set(CLAUSES.map((c) => c.category))];

const RISK_STYLES: Record<RiskLevel, { bg: string; text: string; label: string }> = {
  low: { bg: "#EAF3DE", text: "#1E6D3C", label: "Low risk" },
  medium: { bg: "#FAEEDA", text: "#854F0B", label: "Watch" },
  high: { bg: "#FCEBEB", text: "#A32D2D", label: "High risk" },
};

// ---------------------------------------------------------------------------
// Clause card
// ---------------------------------------------------------------------------

function ClauseCard({ clause }: { clause: Clause }) {
  const [tab, setTab] = useState<"plain" | "flags" | "tips">("plain");
  const risk = RISK_STYLES[clause.risk];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]" style={{ background: "#EEEDFE", color: "#534AB7" }}>
              {clause.category}
            </span>
            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]" style={{ background: risk.bg, color: risk.text }}>
              {risk.label}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-900">{clause.term}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-t border-slate-100">
        {(["plain", "flags", "tips"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="flex-1 py-2 text-[11px] font-semibold transition"
            style={{
              color: tab === t ? "#534AB7" : "#94a3b8",
              borderBottom: tab === t ? "2px solid #534AB7" : "2px solid transparent",
              background: "transparent",
            }}
          >
            {t === "plain" ? "Plain English" : t === "flags" ? "🚩 Red flags" : "💡 Negotiate"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {tab === "plain" ? (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-slate-700">{clause.plainEnglish}</p>
            <div className="rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Example</p>
              <p className="text-[11px] italic leading-relaxed text-slate-600">{clause.example}</p>
            </div>
            <div className="rounded-lg px-3 py-2.5 ring-1 ring-slate-100" style={{ background: "#EEEDFE" }}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#534AB7" }}>Founder stance</p>
              <p className="text-[11px] leading-relaxed" style={{ color: "#3C3489" }}>{clause.founderFriendly}</p>
            </div>
          </div>
        ) : tab === "flags" ? (
          <div className="space-y-2">
            {clause.redFlags.map((flag, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-xs leading-relaxed text-red-800">{flag}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {clause.negotiationTips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg bg-emerald-50 px-3 py-2.5 ring-1 ring-emerald-100">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[8px] font-bold text-white">{i + 1}</span>
                <p className="text-xs leading-relaxed text-emerald-800">{tip}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TermSheetExplainer() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeRisk, setActiveRisk] = useState<RiskLevel | null>(null);

  const { savedData, loaded, save, saveStatus } = useToolkitSave<{ search: string; activeCategory: string | null; activeRisk: string | null }>("term-sheet");

  useEffect(() => {
    if (loaded && savedData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearch(savedData.search ?? "");
      setActiveCategory(savedData.activeCategory ?? null);
      setActiveRisk((savedData.activeRisk as RiskLevel | null) ?? null);
    }
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    save({ search, activeCategory, activeRisk });
  }, [search, activeCategory, activeRisk, loaded, save]);

  const filtered = useMemo(() => {
    return CLAUSES.filter((c) => {
      const matchSearch =
        !search ||
        c.term.toLowerCase().includes(search.toLowerCase()) ||
        c.plainEnglish.toLowerCase().includes(search.toLowerCase());
      const matchCat = !activeCategory || c.category === activeCategory;
      const matchRisk = !activeRisk || c.risk === activeRisk;
      return matchSearch && matchCat && matchRisk;
    });
  }, [search, activeCategory, activeRisk]);

  const highRiskCount = CLAUSES.filter((c) => c.risk === "high").length;

  return (
    <div className="space-y-5">
      {/* Header callout */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs font-semibold text-amber-900">Educational only — not legal advice</p>
        <p className="mt-0.5 text-[11px] text-amber-700">
          This explainer covers common term sheet provisions. Always review your specific terms with a qualified startup attorney before signing.
        </p>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2">
        <SaveChip status={saveStatus} />
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Clauses covered", value: CLAUSES.length, color: "#534AB7" },
          { label: "High-risk terms", value: highRiskCount, color: "#dc2626" },
          { label: "Categories", value: CATEGORIES.length, color: "#16a34a" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl px-3 py-2.5 text-center" style={{ background: "#F8F7FD" }}>
            <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <input
          type="search"
          placeholder="Search clauses (e.g. liquidation, vesting, board)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className="rounded-full px-3 py-1 text-[11px] font-semibold transition"
              style={{
                background: activeCategory === cat ? "#534AB7" : "#F1F5F9",
                color: activeCategory === cat ? "white" : "#475569",
              }}
            >
              {cat}
            </button>
          ))}
          {(["high", "medium", "low"] as RiskLevel[]).map((r) => {
            const s = RISK_STYLES[r];
            return (
              <button
                key={r}
                type="button"
                onClick={() => setActiveRisk(activeRisk === r ? null : r)}
                className="rounded-full px-3 py-1 text-[11px] font-semibold transition"
                style={{
                  background: activeRisk === r ? s.text : s.bg,
                  color: activeRisk === r ? "white" : s.text,
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Count */}
      <p className="text-[11px] text-slate-400">
        Showing {filtered.length} of {CLAUSES.length} clauses
      </p>

      {/* Cards */}
      <div className="space-y-4">
        {filtered.length > 0 ? (
          filtered.map((c) => <ClauseCard key={c.id} clause={c} />)
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
            No clauses match your search. Try a different term.
          </div>
        )}
      </div>
    </div>
  );
}
