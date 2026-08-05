"use client";

import { useState } from "react";
import { ChevronDown, Eye, Users } from "lucide-react";
import type { DataRoomEngagement } from "@/lib/data-room/engagement";

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Heat color scales with a document's share of the top document's views.
function heatColor(ratio: number): string {
  if (ratio >= 0.75) return "#2E78F5";
  if (ratio >= 0.45) return "#5b8def";
  if (ratio >= 0.2) return "#9dbdf5";
  return "#cbdcf9";
}

/**
 * Founder-facing engagement heatmap: which documents investors open most,
 * ranked with heat bars and per-investor drill-down. Pass listDataRoomEngagement().
 */
export function DataRoomEngagementPanel({ engagement }: { engagement: DataRoomEngagement }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { items, maxViews, totalViews, uniqueInvestors } = engagement;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Investor engagement</h2>
          <p className="mt-1 text-sm text-slate-600">Which documents investors open most.</p>
        </div>
        {totalViews > 0 && (
          <div className="flex flex-none gap-4 text-right">
            <div>
              <div className="flex items-center justify-end gap-1 text-slate-900">
                <Eye className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-sm font-semibold">{totalViews}</span>
              </div>
              <div className="text-[11px] text-slate-400">views</div>
            </div>
            <div>
              <div className="flex items-center justify-end gap-1 text-slate-900">
                <Users className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-sm font-semibold">{uniqueInvestors}</span>
              </div>
              <div className="text-[11px] text-slate-400">investors</div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">
            No investor views yet. Once investors open your documents, you&rsquo;ll see which ones draw the most interest.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((item) => {
              const ratio = maxViews > 0 ? item.views / maxViews : 0;
              const isOpen = expanded === item.documentId;
              return (
                <li key={item.documentId} className="rounded-lg">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : item.documentId)}
                    className="group w-full rounded-lg px-2 py-2 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{item.label}</span>
                      <span className="flex-none text-xs tabular-nums text-slate-500">
                        {item.views} view{item.views === 1 ? "" : "s"} · {item.uniqueInvestors} investor
                        {item.uniqueInvestors === 1 ? "" : "s"}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 flex-none text-slate-300 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.max(ratio * 100, 4)}%`, background: heatColor(ratio) }}
                        />
                      </div>
                      <span className="flex-none text-[11px] text-slate-400">{timeAgo(item.lastViewedAt)}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <ul className="mb-1 ml-2 mt-1 space-y-1 border-l border-slate-100 pl-3">
                      {item.viewers.map((v) => (
                        <li key={v.name} className="flex items-center justify-between py-1 text-xs text-slate-600">
                          <span className="truncate">{v.name}</span>
                          <span className="flex-none tabular-nums text-slate-400">
                            {v.views} view{v.views === 1 ? "" : "s"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
