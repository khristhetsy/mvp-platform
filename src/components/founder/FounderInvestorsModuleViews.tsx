"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { ModuleEmptyState, PipelineBoard } from "@/components/ui/ViewToolbar";
import { MetricGrid, PageSection } from "@/components/ui/workspace-layout";
import type { FounderInvestorCrmView, FounderInvestorRelationRow } from "@/lib/data/investor-crm";
import { formatPledgeTotal } from "@/lib/data/investor-pledges";

// ─── Pipeline donut chart ─────────────────────────────────────────────────────

function polarToCart(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSlicePath(cx: number, cy: number, rOuter: number, rInner: number, startAngle: number, endAngle: number) {
  const o1 = polarToCart(cx, cy, rOuter, startAngle);
  const o2 = polarToCart(cx, cy, rOuter, endAngle);
  const i1 = polarToCart(cx, cy, rInner, endAngle);
  const i2 = polarToCart(cx, cy, rInner, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)}`,
    `L ${i1.x.toFixed(2)} ${i1.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i2.x.toFixed(2)} ${i2.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

const DONUT_COLORS = ["#534AB7", "#3B6D11", "#0369a1", "#854F0B"] as const;
const DONUT_LABELS = ["Interested", "Pledged", "Intro Req.", "Follow-up"] as const;

function PipelineDonut({ counts }: Readonly<{ counts: [number, number, number, number] }>) {
  const t = useTranslations("founderCmp");
  const total = counts.reduce((s, v) => s + v, 0);
  if (total === 0) return null;

  const CX = 56, CY = 56, R_OUTER = 48, R_INNER = 32;
  let angle = 0;

  const slices = counts.map((count, i) => {
    const sweep = (count / total) * 360;
    const start = angle;
    // eslint-disable-next-line react-hooks/immutability
    angle += sweep;
    if (sweep < 1) return null;
    return {
      path: donutSlicePath(CX, CY, R_OUTER, R_INNER, start, angle - 0.3),
      color: DONUT_COLORS[i],
      label: DONUT_LABELS[i],
      count,
    };
  }).filter(Boolean);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width="112" height="112" viewBox="0 0 112 112" style={{ flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path key={i} d={s!.path} fill={s!.color} />
        ))}
        <text x={CX} y={CY + 5} textAnchor="middle" style={{ fontSize: 16, fontWeight: 700, fill: "#0c2340" }}>
          {total}
        </text>
        <text x={CX} y={CY + 17} textAnchor="middle" style={{ fontSize: 9, fill: "#94a3b8" }}>
          investors
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: s!.color, flexShrink: 0, display: "inline-block" }} />
            <span style={{ fontSize: 11, color: "#64748b" }}>{s!.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#0c2340", marginLeft: "auto", paddingLeft: 12 }}>{s!.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ViewMode = "kanban" | "grid" | "list";

function formatActivityDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatPipelineStage(stage: string | null) {
  if (!stage) return "—";
  return stage
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAmountRow(row: FounderInvestorRelationRow) {
  if (row.pledgeAmount != null && row.pledgeAmount > 0) {
    return formatPledgeTotal(row.pledgeAmount, row.pledgeCurrency ?? "USD");
  }
  if (row.interestAmount != null && row.interestAmount > 0) {
    return formatPledgeTotal(row.interestAmount, row.pledgeCurrency ?? "USD");
  }
  return "—";
}

function FounderInvestorRelationCard({ row }: Readonly<{ row: FounderInvestorRelationRow }>) {
  const amount = formatAmountRow(row);
  const pipelineStage = row.pipelineStage ? formatPipelineStage(row.pipelineStage) : null;

  return (
    <div className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-panel)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">{row.investorName}</p>
          {row.investorEmail ? <p className="text-xs text-slate-500">{row.investorEmail}</p> : null}
        </div>
        <p className="text-xs text-slate-500">{formatActivityDate(row.lastActivityAt)}</p>
      </div>
      <p className="mt-2 text-sm text-slate-700">{row.actionLabel}</p>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
        {row.status ? <span>Status: {row.status}</span> : null}
        {pipelineStage ? <span>Stage: {pipelineStage}</span> : null}
        {amount !== "—" ? <span>Amount: {amount}</span> : null}
      </div>
      {row.notes ? <p className="mt-2 text-sm leading-6 text-slate-600">{row.notes}</p> : null}
    </div>
  );
}

function collectAllRows(crmView: FounderInvestorCrmView): FounderInvestorRelationRow[] {
  const seen = new Set<string>();
  const rows: FounderInvestorRelationRow[] = [];
  for (const section of Object.values(crmView.sections)) {
    for (const row of section) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        rows.push(row);
      }
    }
  }
  return rows;
}

function filterRows(rows: FounderInvestorRelationRow[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (row) =>
      row.investorName.toLowerCase().includes(q) ||
      (row.investorEmail?.toLowerCase().includes(q) ?? false) ||
      row.actionLabel.toLowerCase().includes(q) ||
      (row.status?.toLowerCase().includes(q) ?? false),
  );
}

const PIPELINE_GROUPS = [
  { id: "interested", title: "Interested", actionTypes: ["interested", "saved_deal"] },
  { id: "pledged", title: "Pledged / Indicative", actionTypes: ["pledged", "indicative_interest"] },
  { id: "intro", title: "Intro Requested", actionTypes: ["intro_requested"] },
  { id: "follow_up", title: "Follow-up", actionTypes: ["follow_up"] },
] as const;

// ─── Pipeline click card ──────────────────────────────────────────────────────

function PipelineClickCard({
  label, value, sub, accentColor, accentBg, onClick,
}: {
  label: string; value: string; sub: string;
  accentColor: string; accentBg: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left overflow-hidden rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-[0.99]"
    >
      <span
        className="mb-2.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest"
        style={{ background: accentBg, color: accentColor }}
      >
        {label}
      </span>
      <p className="text-[2rem] font-medium leading-none text-slate-900">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{sub}</p>
      <div className="mt-3 border-t border-slate-100 pt-2">
        <span className="text-[11px] font-medium" style={{ color: accentColor }}>
          View details →
        </span>
      </div>
    </button>
  );
}

// ─── Pipeline summary drawer ──────────────────────────────────────────────────

type DrawerGroup = "interested" | "pledged" | "intro" | "followup";

const DRAWER_CFG = {
  interested: { label: "Interested",      ac: "#534AB7", ab: "#EEEDFE" },
  pledged:    { label: "Pledged",          ac: "#0F6E56", ab: "#E1F5EE" },
  intro:      { label: "Intro requested", ac: "#185FA5", ab: "#E6F1FB" },
  followup:   { label: "Follow-up",       ac: "#854F0B", ab: "#FAEEDA" },
} as const;

function DrawerStatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 min-w-0 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
      <p className="mb-1 text-[11px] text-slate-400">{label}</p>
      <p className="text-lg font-medium text-slate-900">{value}</p>
    </div>
  );
}

function DrawerRowItem({
  row, ac, ab,
}: {
  row: FounderInvestorRelationRow;
  ac: string;
  ab: string;
}) {
  const amount = formatAmountRow(row);
  return (
    <div className="flex items-center gap-2.5 border-b border-slate-100 py-2 last:border-0">
      <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: ac }} />
      <span className="flex-1 truncate text-[13px] text-slate-900">{row.investorName}</span>
      {amount !== "—" && (
        <span className="flex-shrink-0 text-[11px] text-slate-500">{amount}</span>
      )}
      <span
        className="flex-shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium"
        style={{ background: ab, color: ac }}
      >
        {row.actionLabel}
      </span>
    </div>
  );
}

function PipelineDrawerContent({
  group, allRows, crmView, onClose,
}: {
  group: DrawerGroup;
  allRows: FounderInvestorRelationRow[];
  crmView: FounderInvestorCrmView;
  onClose: () => void;
}) {
  const cfg = DRAWER_CFG[group];

  const interestedRows  = allRows.filter((r) => r.actionType === "interested" || r.actionType === "saved_deal");
  const savedDealCount  = allRows.filter((r) => r.actionType === "saved_deal").length;
  const pledgedRows     = allRows.filter((r) => r.actionType === "pledged" || r.actionType === "indicative_interest");
  const firmCount       = allRows.filter((r) => r.actionType === "pledged").length;
  const indicativeCount = allRows.filter((r) => r.actionType === "indicative_interest").length;
  const introRows       = allRows.filter((r) => r.actionType === "intro_requested");
  const followupRows    = allRows.filter((r) => r.actionType === "follow_up");

  const ic = interestedRows.length;
  const pc = pledgedRows.length;
  const convRate = ic > 0 ? Math.round((pc / ic) * 100) : 0;

  type Entry = {
    count: number;
    stats: { l: string; v: string }[];
    rows: FounderInvestorRelationRow[];
    meaning: string;
    ai: string;
  };

  const DATA: Record<DrawerGroup, Entry> = {
    interested: {
      count: ic,
      stats: [
        { l: "Interested",  v: String(ic - savedDealCount) },
        { l: "Saved deals", v: String(savedDealCount) },
        { l: "Total",       v: String(ic) },
      ],
      rows: interestedRows,
      meaning: `${ic} investor${ic !== 1 ? "s have" : " has"} flagged your deal as interesting. At a typical 25–35% seed-stage conversion rate, this group could yield ${Math.ceil(ic * 0.25)}–${Math.ceil(ic * 0.35)} additional commitments.`,
      ai: `Your interested-to-pledged conversion rate is ${convRate}%${convRate > 22 ? " — above the 22% seed-stage median" : ""}. The ${savedDealCount} investor${savedDealCount !== 1 ? "s" : ""} who saved your deal ${savedDealCount !== 1 ? "are" : "is"} your warmest prospect${savedDealCount !== 1 ? "s" : ""}. Prioritize scheduling calls with them this week before their attention shifts to other deals.`,
    },
    pledged: {
      count: pc,
      stats: [
        { l: "Firm pledges", v: String(firmCount) },
        { l: "Indicative",   v: String(indicativeCount) },
        { l: "Committed",    v: crmView.summary.totalPledgedDisplay },
      ],
      rows: pledgedRows,
      meaning: `You have ${pc} investor${pc !== 1 ? "s" : ""} at commitment stage — ${firmCount} firm pledge${firmCount !== 1 ? "s" : ""} and ${indicativeCount} indicative interest${indicativeCount !== 1 ? "s" : ""}. Investors who commit typically finalize within 6–8 weeks when kept warm with regular updates.`,
      ai: `${crmView.summary.totalPledgedDisplay} in committed capital is strong traction. To protect ${pc === 1 ? "this pledge" : "these pledges"}, send each investor a brief milestone update this week — investors who receive consistent progress notes are 2× more likely to finalize and less likely to reduce their check size.`,
    },
    intro: {
      count: introRows.length,
      stats: [
        { l: "Intro requests",  v: String(introRows.length) },
        { l: "Response window", v: "14 days" },
        { l: "Urgency",         v: "High" },
      ],
      rows: introRows,
      meaning: `${introRows.length} investor${introRows.length !== 1 ? "s have" : " has"} actively requested an introduction. These are warm leads in active evaluation — your highest-urgency pipeline. Response rates drop ~60% after 14 days of silence.`,
      ai: `${introRows.length} intro request${introRows.length !== 1 ? "s" : ""} ${introRows.length !== 1 ? "represent" : "represents"} your highest-conversion pipeline segment. Letting ${introRows.length !== 1 ? "them" : "it"} sit past 14 days drops response rate by ~60%. Reach out to each with a personal note and a proposed call slot before end of this week.`,
    },
    followup: {
      count: followupRows.length,
      stats: [
        { l: "Follow-ups needed",  v: String(followupRows.length) },
        { l: "Re-activation rate", v: "30–40%" },
        { l: "Ideal window",       v: "≤30 days" },
      ],
      rows: followupRows,
      meaning: `${followupRows.length} investor${followupRows.length !== 1 ? "s are" : " is"} waiting for follow-up. These contacts previously engaged with your deal — they are not cold. A personalized update referencing a specific recent milestone re-activates 30–40% of stalled conversations.`,
      ai: `${followupRows.length} investor${followupRows.length !== 1 ? "s" : ""} in your follow-up queue. A one-paragraph update referencing your most recent traction milestone — revenue, users, or a key partnership — re-activates 30–40% of stalled conversations. Investors re-engaged within 30 days close at 3× the rate of those reached after 60 days.`,
    },
  };

  const d = DATA[group];

  return (
    <div className="px-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 py-4">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
            style={{ background: cfg.ac }}
          />
          <span className="text-[13px] font-medium text-slate-900">{cfg.label}</span>
          <span
            className="rounded-md px-2 py-0.5 text-[11px] font-medium"
            style={{ background: cfg.ab, color: cfg.ac }}
          >
            {d.count} investor{d.count !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 focus:outline-none"
          aria-label="Close drawer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Stats row */}
      <div className="mt-3.5 flex gap-2">
        {d.stats.map((s) => (
          <DrawerStatBox key={s.l} label={s.l} value={s.v} />
        ))}
      </div>

      {/* Investor breakdown */}
      {d.rows.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Investor breakdown
          </p>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-1">
            {d.rows.slice(0, 6).map((row) => (
              <DrawerRowItem key={row.id} row={row} ac={cfg.ac} ab={cfg.ab} />
            ))}
            {d.rows.length > 6 && (
              <p className="py-2 text-center text-[11px] text-slate-400">
                +{d.rows.length - 6} more investor{d.rows.length - 6 !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
      )}

      {/* What this means */}
      <div className="mt-3.5 rounded-xl border border-slate-100 bg-slate-50 p-3.5">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          What this means
        </p>
        <p className="text-[13px] leading-relaxed text-slate-700">{d.meaning}</p>
      </div>

      {/* Founder Intelligence */}
      <div className="mt-2.5 rounded-xl p-3.5" style={{ background: "#1e1b4b" }}>
        <div className="mb-2.5 flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="#a5b4fc" strokeWidth={1.75}
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26A7 7 0 0 1 12 2z" />
              <path d="M9 21h6M10 17v-1h4v1" />
            </svg>
          </div>
          <p
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: "#a5b4fc" }}
          >
            Founder intelligence
          </p>
        </div>
        <p className="text-[12px] leading-relaxed" style={{ color: "#e0e7ff" }}>
          {d.ai}
        </p>
      </div>
    </div>
  );
}

// ─── Main view component ──────────────────────────────────────────────────────

function FounderInvestorsModuleViewsInner({
  crmView,
  companyName,
}: Readonly<{ crmView: FounderInvestorCrmView; companyName: string }>) {
  const t = useTranslations("founderCmp");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("kanban");
  const [drawerGroup, setDrawerGroup] = useState<DrawerGroup | null>(null);

  const allRows = useMemo(() => collectAllRows(crmView), [crmView]);
  const filteredRows = useMemo(() => filterRows(allRows, query), [allRows, query]);

  const donutCounts = useMemo<[number, number, number, number]>(() => {
    const interested = allRows.filter((r) => r.actionType === "interested" || r.actionType === "saved_deal").length;
    const pledged    = allRows.filter((r) => r.actionType === "pledged"    || r.actionType === "indicative_interest").length;
    const intro      = allRows.filter((r) => r.actionType === "intro_requested").length;
    const followup   = allRows.filter((r) => r.actionType === "follow_up").length;
    return [interested, pledged, intro, followup];
  }, [allRows]);

  // Sub-labels for the clickable cards
  const cardSubs = useMemo(() => {
    const savedCount      = allRows.filter((r) => r.actionType === "saved_deal").length;
    const firmCount       = allRows.filter((r) => r.actionType === "pledged").length;
    const indicativeCount = allRows.filter((r) => r.actionType === "indicative_interest").length;
    return {
      interested: `${donutCounts[0] - savedCount} interested · ${savedCount} saved`,
      pledged:    `${firmCount} firm · ${indicativeCount} indicative`,
      intro:      `${donutCounts[2]} awaiting introductions`,
      followup:   `${donutCounts[3]} pending follow-ups`,
    };
  }, [allRows, donutCounts]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerGroup ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerGroup]);

  const pipelineColumns = useMemo(() => {
    const groups: Record<string, FounderInvestorRelationRow[]> = {
      interested: [],
      pledged: [],
      intro_requested: [],
      follow_up: [],
      other: [],
    };
    for (const row of filteredRows) {
      if (row.actionType === "interested" || row.actionType === "saved_deal") {
        groups.interested.push(row);
      } else if (row.actionType === "pledged" || row.actionType === "indicative_interest") {
        groups.pledged.push(row);
      } else if (row.actionType === "intro_requested") {
        groups.intro_requested.push(row);
      } else if (row.actionType === "follow_up") {
        groups.follow_up.push(row);
      } else {
        groups.other.push(row);
      }
    }
    return [
      { id: "interested", title: "Interested", items: groups.interested.map((r) => <FounderInvestorRelationCard key={r.id} row={r} />) },
      { id: "pledged", title: "Pledged / Indicative", items: groups.pledged.map((r) => <FounderInvestorRelationCard key={r.id} row={r} />) },
      { id: "intro", title: "Intro Requested", items: groups.intro_requested.map((r) => <FounderInvestorRelationCard key={r.id} row={r} />) },
      { id: "follow_up", title: "Follow-up", items: groups.follow_up.map((r) => <FounderInvestorRelationCard key={r.id} row={r} />) },
    ];
  }, [filteredRows]);

  const groupedForGrid = useMemo(() => {
    return PIPELINE_GROUPS.map((group) => ({
      id: group.id,
      title: group.title,
      rows: filteredRows.filter((r) => (group.actionTypes as readonly string[]).includes(r.actionType)),
    })).filter((g) => g.rows.length > 0);
  }, [filteredRows]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search_investors_status_or_activity")}
          className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {(["kanban", "grid", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                view === v
                  ? "border border-slate-200 bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {v === "kanban" ? "⊞ Kanban" : v === "grid" ? "⊟ Grid" : "≡ List"}
            </button>
          ))}
        </div>
      </div>

      <PageSection title={t("pipeline_summary")} subtitle={companyName}>
        <div className="flex flex-wrap items-start gap-5">
          {donutCounts[0] + donutCounts[1] + donutCounts[2] + donutCounts[3] > 0 && (
            <div
              className="shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4"
              style={{ boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)" }}
            >
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{t("pipeline_at_a_glance")}</p>
              <PipelineDonut counts={donutCounts} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <MetricGrid>
              <PipelineClickCard
                label={t("interested")}
                value={String(donutCounts[0])}
                sub={cardSubs.interested}
                accentColor="#534AB7"
                accentBg="#EEEDFE"
                onClick={() => setDrawerGroup("interested")}
              />
              <PipelineClickCard
                label={t("pledged")}
                value={crmView.summary.totalPledgedDisplay}
                sub={cardSubs.pledged}
                accentColor="#0F6E56"
                accentBg="#E1F5EE"
                onClick={() => setDrawerGroup("pledged")}
              />
              <PipelineClickCard
                label={t("intro_requested")}
                value={String(donutCounts[2])}
                sub={cardSubs.intro}
                accentColor="#185FA5"
                accentBg="#E6F1FB"
                onClick={() => setDrawerGroup("intro")}
              />
              <PipelineClickCard
                label={t("follow_up")}
                value={String(donutCounts[3])}
                sub={cardSubs.followup}
                accentColor="#854F0B"
                accentBg="#FAEEDA"
                onClick={() => setDrawerGroup("followup")}
              />
            </MetricGrid>
          </div>
        </div>
      </PageSection>

      <PageSection>
        {filteredRows.length === 0 ? (
          <ModuleEmptyState title={t("no_matching_investors")} description={t("try_adjusting_your_search_or_check_back_when")} />
        ) : view === "kanban" ? (
          <PipelineBoard columns={pipelineColumns} density="comfortable" />
        ) : view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {groupedForGrid.map((group) => (
              <WorkspacePanel key={group.id} title={group.title} subtitle={`${group.rows.length} investor${group.rows.length !== 1 ? "s" : ""}`}>
                <div className="space-y-2">
                  {group.rows.map((row) => (
                    <FounderInvestorRelationCard key={row.id} row={row} />
                  ))}
                </div>
              </WorkspacePanel>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                  <th className="px-4 py-3">Investor</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.investorName}</p>
                      {row.investorEmail ? <p className="text-xs text-slate-400">{row.investorEmail}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.actionLabel}</td>
                    <td className="px-4 py-3 text-slate-500">{row.status ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{row.pipelineStage ? formatPipelineStage(row.pipelineStage) : "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{formatAmountRow(row)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatActivityDate(row.lastActivityAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>

      {/* ── Pipeline summary drawer overlay ── */}
      <div
        className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
        style={{ opacity: drawerGroup ? 1 : 0, pointerEvents: drawerGroup ? "auto" : "none", transition: "opacity 200ms" }}
        aria-hidden={!drawerGroup}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0"
          style={{ background: "rgba(12, 35, 64, 0.28)" }}
          onClick={() => setDrawerGroup(null)}
        />
        {/* Drawer panel */}
        <div
          className="relative w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
          style={{
            maxWidth: 448,
            maxHeight: 536,
            transform: drawerGroup ? "translateY(0)" : "translateY(40px)",
            transition: "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {drawerGroup && (
            <PipelineDrawerContent
              group={drawerGroup}
              allRows={allRows}
              crmView={crmView}
              onClose={() => setDrawerGroup(null)}
            />
          )}
        </div>
      </div>
    </>
  );
}

export function FounderInvestorsModuleViews(props: Readonly<{ crmView: FounderInvestorCrmView; companyName: string }>) {
  const t = useTranslations("founderCmp");
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">{t("loading_view_options")}</p>}>
      <FounderInvestorsModuleViewsInner {...props} />
    </Suspense>
  );
}
