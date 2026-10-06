"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Highlight } from "@/components/ui/SearchStatus";
import { heatLevel, receivedCell, sentCell, type CellText } from "@/lib/analytics/message-activity-cells";
import {
  RECEIVED_COLUMNS,
  SENT_COLUMNS,
  localDay,
  localTime,
  receivedType,
  shortDay,
  type MessageActivityData,
  type MessagePerson,
  type ReceivedItem,
  type ReceivedType,
  type SentItem,
  type SentKind,
} from "@/lib/analytics/message-activity-metrics";

export type HeatRow = { person: MessagePerson; received: ReceivedItem[]; sent: SentItem[]; last: string };

// Alerts lead: they are the column to act on. Fewer is better there.
const RECEIVED_ORDER: ReceivedType[] = ["alert", "reminder", "remediation", "email", "intro", "other"];
const SENT_ORDER: SentKind[] = ["preview", "intro", "diy"];

const BLUE = ["", "bg-[#E6F1FB] text-[#0C447C]", "bg-[#B5D4F4] text-[#0C447C]", "bg-[#378ADD] text-white", "bg-[#185FA5] text-white"];
const ORANGE = ["", "bg-[#FAECE7] text-[#712B13]", "bg-[#F5C4B3] text-[#712B13]", "bg-[#D85A30] text-white"];

const FIXED_W = 178;
const COL_W = 138;

type Col = {
  key: string;
  label: string;
  group: "received" | "sent";
  alert: boolean;
  text: (r: HeatRow) => CellText;
  open: (r: HeatRow) => void;
  openAll: () => void;
};

/**
 * The "By person" table: company pinned on the left, one shaded two line cell per
 * message type scrolling sideways with large arrows. Darker = more; alerts are
 * orange because fewer is better. Any non zero cell opens the items behind it.
 */
export function PersonHeatTable({
  rows,
  totalLabel,
  query,
  data,
  current,
  openReceived,
  openSent,
}: Readonly<{
  rows: HeatRow[];
  /** "6 of 15 founders" */
  totalLabel: string;
  query: string;
  data: Pick<MessageActivityData, "queued" | "allowance">;
  /** The period includes today, so the live allowance and queue apply. */
  current: boolean;
  openReceived: (person: MessagePerson | null, type: ReceivedType | "all") => void;
  openSent: (person: MessagePerson | null, kind: SentKind | "all") => void;
}>) {
  const cols: Col[] = [
    ...RECEIVED_ORDER.map((t): Col => {
      const c = RECEIVED_COLUMNS.find((x) => x.type === t)!;
      return {
        key: `r-${t}`, label: c.short, group: "received", alert: t === "alert",
        text: (r) => receivedCell(r.received.filter((x) => receivedType(x) === t)),
        open: (r) => openReceived(r.person, t),
        openAll: () => openReceived(null, t),
      };
    }),
    {
      key: "r-total", label: "Total received", group: "received", alert: false,
      text: (r) => {
        const inApp = r.received.filter((x) => x.channel === "in_app").length;
        const detail = [inApp ? `${inApp} in app` : "", r.received.length - inApp ? `${r.received.length - inApp} email` : ""].filter(Boolean).join(" · ");
        return { count: r.received.length, status: "", detail, tip: detail };
      },
      open: (r) => openReceived(r.person, "all"),
      openAll: () => openReceived(null, "all"),
    },
    ...SENT_ORDER.map((k): Col => {
      const c = SENT_COLUMNS.find((x) => x.kind === k)!;
      return {
        key: `s-${k}`, label: c.short, group: "sent", alert: false,
        text: (r) =>
          sentCell(
            r.sent.filter((x) => x.kind === k),
            k === "preview" && current ? { queued: data.queued[r.person.key], allowance: data.allowance[r.person.key] } : {},
          ),
        open: (r) => openSent(r.person, k),
        openAll: () => openSent(null, k),
      };
    }),
    {
      key: "s-total", label: "Total sent", group: "sent", alert: false,
      text: (r) => {
        const investors = new Set(r.sent.filter((x) => x.kind !== "intro" && x.status !== "skipped").map((x) => x.investorEmail ?? x.investor)).size;
        const detail = investors ? `${investors} investor${investors === 1 ? "" : "s"} reached` : "";
        return { count: r.sent.length, status: "", detail, tip: detail };
      },
      open: (r) => openSent(r.person, "all"),
      openAll: () => openSent(null, "all"),
    },
  ];

  // Cell text once per render, and each column's busiest row for the shading.
  const grid = rows.map((r) => cols.map((c) => c.text(r)));
  const maxOf = cols.map((_, ci) => Math.max(0, ...grid.map((g) => g[ci].count)));

  // Arrows: shown only when there is more to scroll that way.
  const scroller = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const s = scroller.current;
    if (!s) return;
    setEdge({ left: s.scrollLeft > 4, right: s.scrollLeft + s.clientWidth < s.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    measure();
    const s = scroller.current;
    if (!s || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(s);
    return () => ro.disconnect();
  }, [measure, rows.length]);
  const scrollBy = (dir: number) => {
    const s = scroller.current;
    if (s) s.scrollBy({ left: dir * Math.max(COL_W, (s.clientWidth - FIXED_W) * 0.8), behavior: "smooth" });
  };

  const receivedCount = cols.filter((c) => c.group === "received").length;
  const sentCount = cols.length - receivedCount;
  const head = "h-[26px] px-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 whitespace-nowrap";
  const arrow =
    "absolute top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="relative">
        {edge.left ? (
          <button type="button" onClick={() => scrollBy(-1)} aria-label="Scroll left" className={arrow} style={{ left: FIXED_W + 6 }}>
            <i className="ti ti-chevron-left text-2xl" aria-hidden="true" />
          </button>
        ) : null}
        {edge.right ? (
          <button type="button" onClick={() => scrollBy(1)} aria-label="Scroll right" className={`${arrow} right-1.5`}>
            <i className="ti ti-chevron-right text-2xl" aria-hidden="true" />
          </button>
        ) : null}
        <div ref={scroller} onScroll={measure} className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="table-fixed border-separate border-spacing-0 text-[12px]" style={{ width: FIXED_W + (cols.length + 1) * COL_W }}>
            <colgroup>
              <col style={{ width: FIXED_W }} />
              {cols.map((c) => <col key={c.key} style={{ width: COL_W }} />)}
              <col style={{ width: COL_W }} />
            </colgroup>
            <thead className="bg-slate-50">
              <tr>
                <th className="sticky left-0 z-10 border-r border-slate-300 bg-slate-50" />
                <th colSpan={receivedCount} className="h-5 border-b border-slate-200 px-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#185FA5]">
                  Received by founder
                </th>
                <th colSpan={sentCount + 1} className="h-5 border-b border-l border-slate-200 px-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#185FA5]">
                  Sent to investors
                </th>
              </tr>
              <tr>
                <th className={`${head} sticky left-0 z-10 border-b border-r border-slate-200 border-r-slate-300 bg-slate-50`}>Company</th>
                {cols.map((c, i) => (
                  <th key={c.key} className={`${head} border-b border-slate-200 ${i === receivedCount ? "border-l" : ""}`}>
                    <button type="button" onClick={c.openAll} className="uppercase tracking-[0.06em] underline decoration-dotted underline-offset-4 hover:text-[#1A6CE4]" title={`View all ${c.label.toLowerCase()} in this period`}>
                      {c.label}
                    </button>
                  </th>
                ))}
                <th className={`${head} border-b border-slate-200`}>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={r.person.key}>
                  <td className="sticky left-0 z-10 h-[46px] border-b border-r border-slate-100 border-r-slate-300 bg-white px-2.5 py-1 align-middle">
                    <div className="truncate text-[13px] font-semibold text-slate-900" title={r.person.company ?? r.person.name}>
                      <Highlight text={r.person.company ?? r.person.name} query={query} />
                    </div>
                    <div className="truncate text-[11.5px] text-slate-500" title={`${r.person.name} <${r.person.email}>`}>
                      {r.person.company ? <><Highlight text={r.person.name} query={query} /> · </> : null}
                      <Highlight text={r.person.role === "investor" ? "Investor" : r.person.plan} query={query} />
                    </div>
                  </td>
                  {cols.map((c, ci) => {
                    const t = grid[ri][ci];
                    const steps = c.alert ? 3 : 4;
                    const lvl = heatLevel(t.count, maxOf[ci], steps);
                    const tone = lvl ? (c.alert ? ORANGE : BLUE)[lvl] : "text-slate-400";
                    const body = (
                      <>
                        <div className="truncate">
                          <span className="text-[14px] font-semibold tabular-nums">{t.count}</span>
                          {t.status ? <span className="ml-1 text-[11px] opacity-85">{t.status}</span> : null}
                        </div>
                        {t.detail ? <div className="truncate text-[11px] opacity-85">{t.detail}</div> : null}
                      </>
                    );
                    const box = `flex h-[42px] w-full flex-col justify-center rounded-[5px] px-2 text-left leading-[1.35] ${tone}`;
                    return (
                      <td key={c.key} className={`border-b border-slate-100 p-[2px] align-middle ${ci === receivedCount ? "border-l border-l-slate-200" : ""}`}>
                        {t.count ? (
                          <button type="button" onClick={() => c.open(r)} className={`${box} hover:ring-2 hover:ring-[#2E78F5]/50`} title={t.tip} aria-label={`View ${t.count} ${c.label.toLowerCase()} for ${r.person.company ?? r.person.name}`}>
                            {body}
                          </button>
                        ) : (
                          <div className={box} title={t.tip || undefined}>{body}</div>
                        )}
                      </td>
                    );
                  })}
                  <td className="border-b border-slate-100 px-2.5 align-middle text-slate-700">
                    {r.last ? (
                      <>
                        <div>{shortDay(localDay(r.last))}</div>
                        <div className="font-mono text-[11px] text-slate-500">{localTime(r.last)}</div>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-2.5 py-2 text-xs text-slate-500">
        <span>{totalLabel} · busiest first</span>
        <span className="flex flex-wrap gap-3 text-[11px]">
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#378ADD] align-[-1px]" />Messages</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#D85A30] align-[-1px]" />Alerts, fewer is better</span>
          <span>Darker = more</span>
        </span>
      </div>
    </div>
  );
}
