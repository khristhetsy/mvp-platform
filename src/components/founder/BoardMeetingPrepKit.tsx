"use client";

import { useState, useEffect } from "react";
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
// Types & data
// ---------------------------------------------------------------------------

type BoardStage = "seed" | "series_a";

type AgendaItem = {
  id: string;
  title: string;
  duration: string;
  owner: string;
  description: string;
  tips: string[];
};

type MetricField = {
  id: string;
  label: string;
  placeholder: string;
  category: string;
};

const AGENDA_ITEMS: Record<BoardStage, AgendaItem[]> = {
  seed: [
    {
      id: "a1", title: "CEO update & highlights", duration: "10 min", owner: "CEO",
      description: "Top 2–3 things that happened since last board meeting. Keep to the most consequential items.",
      tips: ["Lead with a win, then a challenge — sets honest tone", "Don't pad with good news — boards see through it", "Come with a clear ask or decision you need from the board"],
    },
    {
      id: "a2", title: "Financial review", duration: "15 min", owner: "CEO / CFO",
      description: "P&L vs. plan, cash position, runway, key variances.",
      tips: ["Show actuals vs. plan — not just actuals", "Highlight what drove any significant variance", "State runway clearly and your next funding milestone"],
    },
    {
      id: "a3", title: "Product & growth metrics", duration: "15 min", owner: "CEO / CTO",
      description: "MRR/ARR trend, customer count, churn, key product milestones.",
      tips: ["Show the trend, not just the point — boards want to see momentum", "If a metric is bad, own it and present the plan"],
    },
    {
      id: "a4", title: "Key hires & team", duration: "10 min", owner: "CEO",
      description: "Open roles, recent hires, and any org design decisions.",
      tips: ["Flag open roles where board intros would help", "Be honest about performance issues — boards find out anyway"],
    },
    {
      id: "a5", title: "Discussion — strategic topic", duration: "20 min", owner: "Board",
      description: "One meaty strategic question for the board's input. Prepare options, not just open questions.",
      tips: ["Frame as: 'We're deciding between A and B. Here's our current thinking.'", "Don't use board time to inform — use it to decide", "Pre-share the framing in the board pre-read"],
    },
    {
      id: "a6", title: "Asks & next steps", duration: "10 min", owner: "CEO",
      description: "Specific introductions, expertise, or resources you need from each board member.",
      tips: ["Be specific: 'Can you intro us to the Head of Revenue at Stripe?'", "Assign names to asks — don't make it general", "Send a follow-up email same day with action items"],
    },
  ],
  series_a: [
    {
      id: "b1", title: "Approval of prior minutes", duration: "5 min", owner: "Chair",
      description: "Formal approval of minutes from last board meeting.",
      tips: ["Distribute minutes 48h before the meeting", "Keep minutes factual — they are a legal document"],
    },
    {
      id: "b2", title: "CEO update", duration: "10 min", owner: "CEO",
      description: "Top priorities and summary since last meeting. Concise — detail is in the pre-read.",
      tips: ["Assume board read the pre-read — don't re-present it", "Use this time for what can't be conveyed in writing: tone, energy, conviction"],
    },
    {
      id: "b3", title: "Financial review", duration: "20 min", owner: "CFO",
      description: "P&L, balance sheet, cash flow, headcount, and 13-week cash forecast.",
      tips: ["Show actuals vs. budget vs. prior forecast — three-way comparison", "Walk through headcount by department and plan vs. actual", "Forecast should go to the next major milestone, not just 3 months"],
    },
    {
      id: "b4", title: "GTM & revenue review", duration: "20 min", owner: "CRO / CEO",
      description: "Pipeline, bookings, churn, NRR, CAC, and LTV.",
      tips: ["Lead with ARR bridge: new, expansion, churn → net new ARR", "Walk through conversion rates at each pipeline stage", "Flag any ICP shifts or sales cycle changes"],
    },
    {
      id: "b5", title: "Product & engineering update", duration: "15 min", owner: "CTO / CPO",
      description: "Roadmap progress, key launches, tech debt, and hiring.",
      tips: ["Show what shipped vs. what was planned", "One slide on key architectural decisions or risks if relevant"],
    },
    {
      id: "b6", title: "Strategic discussion", duration: "30 min", owner: "Board",
      description: "One prepared strategic topic requiring board input or decision.",
      tips: ["Circulate the framing doc 72h before", "Present options with pros/cons, not just a question", "Facilitate — don't lecture. Boards add most value in dialogue."],
    },
    {
      id: "b7", title: "Executive session", duration: "15 min", owner: "Board only",
      description: "Board members meet without management. Standard at Series A+.",
      tips: ["Leave the room confidently — this is normal governance", "CEO should rejoin briefly at end for any feedback"],
    },
    {
      id: "b8", title: "Approvals & action items", duration: "10 min", owner: "Chair",
      description: "Formal votes, action item assignment, next meeting date.",
      tips: ["Send written action items same day", "Note who owns each item and by when"],
    },
  ],
};

const METRIC_FIELDS: MetricField[] = [
  { id: "arr", label: "ARR / MRR", placeholder: "$420K ARR / $35K MRR", category: "Revenue" },
  { id: "arr_growth", label: "ARR growth (MoM or QoQ)", placeholder: "+18% MoM", category: "Revenue" },
  { id: "customers", label: "Total customers", placeholder: "42 paying customers", category: "Revenue" },
  { id: "new_customers", label: "New customers this period", placeholder: "+6 new logos", category: "Revenue" },
  { id: "churn", label: "Gross churn rate", placeholder: "2.1% monthly", category: "Retention" },
  { id: "nrr", label: "Net revenue retention", placeholder: "112%", category: "Retention" },
  { id: "cash", label: "Cash on hand", placeholder: "$2.1M", category: "Financials" },
  { id: "burn", label: "Monthly burn", placeholder: "$85K/month", category: "Financials" },
  { id: "runway", label: "Runway", placeholder: "24 months", category: "Financials" },
  { id: "headcount", label: "Headcount", placeholder: "8 FTE (+ 2 open roles)", category: "Team" },
  { id: "cac", label: "CAC", placeholder: "$1,200", category: "Unit economics" },
  { id: "ltv", label: "LTV", placeholder: "$14,400", category: "Unit economics" },
];

// ---------------------------------------------------------------------------
// Pre-read template
// ---------------------------------------------------------------------------

function buildPreRead(stage: BoardStage, metrics: Record<string, string>, company: string, period: string): string {
  const co = company || "[Company]";
  const per = period || "[Quarter]";
  const agenda = AGENDA_ITEMS[stage];

  let text = `${co} Board Meeting Pre-Read\n`;
  text += `${per}\n`;
  text += `Confidential — Board members only\n\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `AGENDA\n\n`;
  agenda.forEach((item, i) => {
    text += `${i + 1}. ${item.title} (${item.duration}) — ${item.owner}\n`;
  });
  text += `\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `KEY METRICS SNAPSHOT\n\n`;

  const categories = [...new Set(METRIC_FIELDS.map((f) => f.category))];
  categories.forEach((cat) => {
    const fields = METRIC_FIELDS.filter((f) => f.category === cat);
    const filled = fields.filter((f) => metrics[f.id]?.trim());
    if (filled.length > 0) {
      text += `${cat.toUpperCase()}\n`;
      filled.forEach((f) => {
        text += `  ${f.label}: ${metrics[f.id]}\n`;
      });
      text += "\n";
    }
  });

  text += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `HIGHLIGHTS\n\n`;
  text += `[Add 3–5 bullet points on key wins and events since last board meeting]\n\n`;
  text += `LOWLIGHTS / RISKS\n\n`;
  text += `[Add 2–3 honest points on what isn't going well and your mitigation plan]\n\n`;
  text += `STRATEGIC DISCUSSION FRAMING\n\n`;
  text += `[Paste framing for your board discussion topic here: context, options, your recommendation]\n\n`;
  text += `ASKS FROM THE BOARD\n\n`;
  text += `[Name] — [Specific ask]\n`;
  text += `[Name] — [Specific ask]\n\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Prepared by: [Your name]\n`;
  text += `Distributed: [Date — target 48h before meeting]\n`;

  return text;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AgendaCard({ item, index }: { item: AgendaItem; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const colors = ["#534AB7", "#059669", "#0ea5e9", "#7c3aed", "#d97706", "#dc2626", "#0f766e", "#be185d"];
  const color = colors[index % colors.length];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((o) => !o)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: color }}>
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <span className="text-[10px] text-slate-400">{item.duration} · {item.owner}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">{item.description}</p>
        </div>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"
          className="mt-1 shrink-0 transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
          <path d="M6 9l6 6 6-6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {expanded ? (
        <div className="border-t border-slate-100 px-4 py-3 space-y-1">
          {item.tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-0.5 text-[10px]" style={{ color }}>•</span>
              <p className="text-[11px] leading-relaxed text-slate-600">{tip}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BoardMeetingPrepKit() {
  const [stage, setStage] = useState<BoardStage>("seed");
  const [tab, setTab] = useState<"agenda" | "metrics" | "preread">("agenda");
  const [metrics, setMetrics] = useState<Record<string, string>>({});
  const [company, setCompany] = useState("");
  const [period, setPeriod] = useState("");
  const [copied, setCopied] = useState(false);

  const { savedData, loaded, save, saveStatus } = useToolkitSave<{ stage: string; metrics: Record<string, string>; company: string; period: string }>("board-prep");

  useEffect(() => {
    if (loaded && savedData) {
      setStage((savedData.stage as BoardStage) ?? "seed");
      setMetrics(savedData.metrics ?? {});
      setCompany(savedData.company ?? "");
      setPeriod(savedData.period ?? "");
    }
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    save({ stage, metrics, company, period });
  }, [stage, metrics, company, period, loaded, save]);

  const agenda = AGENDA_ITEMS[stage];
  const totalDuration = agenda.reduce((sum, item) => {
    const match = item.duration.match(/(\d+)/);
    return sum + (match ? parseInt(match[1]) : 0);
  }, 0);

  const preRead = buildPreRead(stage, metrics, company, period);

  function copy() {
    navigator.clipboard.writeText(preRead).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <SaveChip status={saveStatus} />
      </div>

      {/* Stage selector */}
      <div className="flex items-center gap-3">
        <p className="text-xs font-semibold text-slate-700">Board stage:</p>
        {(["seed", "series_a"] as BoardStage[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStage(s)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition"
            style={{ background: stage === s ? "#534AB7" : "#F1F5F9", color: stage === s ? "white" : "#475569" }}
          >
            {s === "seed" ? "Seed" : "Series A"}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-slate-400">{totalDuration} min total</span>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
        {(["agenda", "metrics", "preread"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="flex-1 rounded-lg py-2 text-xs font-semibold transition"
            style={{
              background: tab === t ? "white" : "transparent",
              color: tab === t ? "#534AB7" : "#94a3b8",
              boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {t === "agenda" ? "Agenda" : t === "metrics" ? "Metrics snapshot" : "Pre-read template"}
          </button>
        ))}
      </div>

      {/* Agenda tab */}
      {tab === "agenda" ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-indigo-100 bg-[#FAFAFF] px-4 py-3">
            <p className="text-xs font-semibold" style={{ color: "#534AB7" }}>How to run a great board meeting</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
              Send the pre-read 48h before. Start on time. Use the meeting to decide, not to inform — boards should read the materials in advance. Leave with clear action items and owners.
            </p>
          </div>
          {agenda.map((item, i) => (
            <AgendaCard key={item.id} item={item} index={i} />
          ))}
        </div>
      ) : null}

      {/* Metrics tab */}
      {tab === "metrics" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Company name</label>
              <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Period</label>
              <input type="text" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Q1 2026" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100" />
            </div>
          </div>
          {[...new Set(METRIC_FIELDS.map((f) => f.category))].map((cat) => (
            <div key={cat}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{cat}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {METRIC_FIELDS.filter((f) => f.category === cat).map((field) => (
                  <div key={field.id}>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">{field.label}</label>
                    <input
                      type="text"
                      value={metrics[field.id] ?? ""}
                      onChange={(e) => setMetrics((prev) => ({ ...prev, [field.id]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Pre-read tab */}
      {tab === "preread" ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-800">
            <span className="font-semibold">Before you send: </span>
            Fill in the Metrics Snapshot tab first — those values populate automatically here. Replace everything in [brackets] before distributing.
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Pre-read draft</p>
              <button
                type="button"
                onClick={copy}
                className="text-[11px] font-semibold transition"
                style={{ color: copied ? "#059669" : "#534AB7" }}
              >
                {copied ? "Copied!" : "Copy all"}
              </button>
            </div>
            <pre className="whitespace-pre-wrap px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-700">
              {preRead}
            </pre>
          </div>
        </div>
      ) : null}

      {/* Best practices footer */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Board meeting best practices</p>
        <div className="space-y-1">
          {[
            "Send the pre-read 48 hours before — not the morning of",
            "Keep the board deck under 15 slides. Supplemental data goes in the appendix",
            "Don't surprise the board in the meeting. Pre-call your lead investor the day before",
            "Send action items within 24 hours of the meeting",
            "Record decisions made and votes taken — your legal counsel will thank you later",
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-0.5 text-[10px] text-slate-400">•</span>
              <p className="text-[11px] leading-relaxed text-slate-600">{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
