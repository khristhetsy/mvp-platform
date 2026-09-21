"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MetricCard } from "@/components/MetricCard";
import { SearchCount, Highlight, NoSearchMatches } from "@/components/ui/SearchStatus";
import { matchRows } from "@/lib/ui/live-search";
import type { ActivityFeedItem, ActivityStageGroup, DateRangeKey } from "@/lib/activity/feed";
import { DATE_RANGES, DATE_RANGE_LABEL } from "@/lib/activity/feed";
import {
  ACTIVITY_CLASSES,
  type ActivityAudience,
  type ActivityClassKey,
  type ActivityStage,
  activityClass,
  activityStageLabel,
  audienceOfStage,
  isFounderStage,
} from "@/lib/activity/stages";
import type { StageAssignmentBoard } from "@/lib/activity/assignments";

const SEVERITY_DOT: Record<string, string> = {
  critical: "#DC2626",
  high: "#DC2626",
  medium: "#B45309",
  low: "#059669",
  info: "#64748B",
};

function stagePillClass(stage: ActivityStage): string {
  if (!isFounderStage(stage)) return "bg-violet-50 text-violet-800";
  return {
    initialize: "bg-indigo-50 text-indigo-800",
    qualify: "bg-cyan-50 text-cyan-800",
    deploy: "bg-orange-50 text-orange-800",
    optimize: "bg-emerald-50 text-emerald-800",
  }[stage];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function AccountActivityClient({
  audience,
  range,
  customFrom,
  customTo,
  groups,
  totalInWindow,
  typeCounts,
  assignments,
  coverage,
}: Readonly<{
  audience: ActivityAudience | "both";
  range: DateRangeKey;
  customFrom: string | null;
  customTo: string | null;
  groups: ActivityStageGroup[];
  totalInWindow: number;
  typeCounts: Record<string, number>;
  assignments: StageAssignmentBoard;
  coverage: { instrumentedClasses: number; totalClasses: number };
}>) {
  const router = useRouter();
  const params = useSearchParams();

  const [typed, setTyped] = useState("");
  const [facets, setFacets] = useState<ActivityClassKey[]>([]);
  const [dropOpen, setDropOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<ActivityStage>>(new Set());
  const [marking, setMarking] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());

  /**
   * Marking seen is what stops the escalation clock, so it records the caller
   * specifically — one person glancing at the feed must not silence a stage
   * they do not hold.
   */
  async function markSeen(eventIds: string[]) {
    if (!eventIds.length) return;
    setMarking(true);
    try {
      const res = await fetch("/api/admin/activity/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds }),
      });
      if (res.ok) setSeen((s) => new Set([...s, ...eventIds]));
    } finally {
      setMarking(false);
    }
  }

  function go(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    }
    router.push(`/admin/activity?${sp.toString()}`);
  }

  // Facet first, then live text — the same order the count line reports, so
  // "6 of 23" always means "6 of the 23 the facet left".
  const facetSet = useMemo(() => new Set(facets), [facets]);
  const facetedGroups = useMemo(
    () =>
      groups.map((g) => ({
        ...g,
        items: facetSet.size
          ? g.items.filter((i) => i.classKey && facetSet.has(i.classKey))
          : g.items,
      })),
    [groups, facetSet],
  );

  const allFaceted = useMemo(() => facetedGroups.flatMap((g) => g.items), [facetedGroups]);

  const searched = useMemo(
    () =>
      matchRows<ActivityFeedItem>(
        allFaceted,
        [
          { label: "company", get: (r) => r.companyName },
          { label: "actor", get: (r) => r.actorName },
          { label: "activity", get: (r) => r.title },
          { label: "detail", get: (r) => r.description },
          { label: "stage", get: (r) => (r.stage ? activityStageLabel(r.stage) : "") },
        ],
        typed,
      ),
    [allFaceted, typed],
  );

  const keptIds = useMemo(() => new Set(searched.rows.map((r) => r.id)), [searched.rows]);
  const visibleGroups = useMemo(
    () =>
      facetedGroups.map((g) => ({ ...g, items: g.items.filter((i) => keptIds.has(i.id)) })),
    [facetedGroups, keptIds],
  );

  // A search must never hide a match inside a closed fold.
  const searching = typed.trim().length > 0 || facetSet.size > 0;

  const leadOf = useMemo(() => {
    const map = new Map<ActivityStage, string | null>();
    for (const s of assignments.stages) {
      const lead = s.leadUserId
        ? (assignments.staff.find((m) => m.id === s.leadUserId)?.name ?? null)
        : null;
      map.set(s.stage, lead);
    }
    return map;
  }, [assignments]);

  const assigneesOf = useMemo(() => {
    const map = new Map<ActivityStage, typeof assignments.staff>();
    for (const s of assignments.stages) {
      map.set(
        s.stage,
        s.userIds
          .map((id) => assignments.staff.find((m) => m.id === id))
          .filter(Boolean) as typeof assignments.staff,
      );
    }
    return map;
  }, [assignments]);

  const relevantClasses = ACTIVITY_CLASSES.filter((c) =>
    audience === "both" ? true : audienceOfStage(c.stage) === audience,
  );

  return (
    <div className="space-y-4">
      {/* Coverage — the honest state of instrumentation, not a vanity tile. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Activity classes seen"
          value={`${coverage.instrumentedClasses}`}
          unit={`of ${coverage.totalClasses}`}
          detail="Classes that have produced at least one real event"
          audience="admin"
          ring={{
            percent: coverage.totalClasses
              ? Math.round((coverage.instrumentedClasses / coverage.totalClasses) * 100)
              : 0,
            center: `${coverage.instrumentedClasses}`,
            sublabel: "wired",
          }}
          flag={
            coverage.instrumentedClasses < coverage.totalClasses
              ? {
                  text: `${coverage.totalClasses - coverage.instrumentedClasses} classes have never fired`,
                  tone: "warn",
                }
              : null
          }
        />
        <MetricCard
          label="Events in this window"
          value={`${totalInWindow}`}
          unit={DATE_RANGE_LABEL[range].toLowerCase()}
          detail="Before the activity-type filter"
          audience="admin"
          ring={{ percent: null, pending: true, center: "—", sublabel: "no ceiling" }}
        />
        <MetricCard
          label="Stages with no lead"
          value={`${assignments.stages.filter((s) => !s.leadUserId).length}`}
          unit={`of ${assignments.stages.length}`}
          detail="A stage with no lead routes to every super_admin"
          href="/admin/activity/assignments"
          audience="admin"
          ring={{
            percent: assignments.stages.length
              ? Math.round(
                  (assignments.stages.filter((s) => s.leadUserId).length /
                    assignments.stages.length) *
                    100,
                )
              : 0,
            center: `${assignments.stages.filter((s) => s.leadUserId).length}`,
            sublabel: "led",
          }}
          flag={
            assignments.stages.some((s) => !s.leadUserId)
              ? { text: "Unassigned stages fall back to super_admins", tone: "bad" }
              : { text: "Every stage has a named lead", tone: "good" }
          }
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        {/* Card header — actions right-aligned, secondary then primary. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold">All account activity</h2>
          <span className="flex-1" />
          <span className="text-xs text-slate-500">
            {searched.rows.length} of {totalInWindow}
          </span>
          <Link
            href="/admin/activity/assignments"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            Stage assignment
          </Link>
          <Link
            href="/admin/activity/alerts"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            Alert settings
          </Link>
          <button
            type="button"
            onClick={() =>
              setCollapsed((c) =>
                c.size ? new Set() : new Set(visibleGroups.map((g) => g.stage)),
              )
            }
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            {collapsed.size ? "Expand all" : "Collapse all"}
          </button>
          <button
            type="button"
            disabled={marking || searched.rows.length === 0}
            onClick={() => void markSeen(searched.rows.map((r) => r.id))}
            className="rounded-lg border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {marking ? "Marking…" : "Mark all seen"}
          </button>
        </div>

        <div className="space-y-2 px-4 pb-1 pt-3">
          {/* Audience — swaps the fold axis, not just the filter. */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-xs">
              {(["founder", "investor", "both"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => go({ audience: a })}
                  className={`border-r border-slate-200 px-3 py-1.5 last:border-r-0 ${
                    audience === a ? "bg-indigo-600 font-semibold text-white" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {a === "founder" ? "Founders" : a === "investor" ? "Investors" : "Both"}
                </button>
              ))}
            </div>

            {/* Search: free text plus an activity-type facet. */}
            <div className="relative min-w-[260px] flex-1">
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
                <span className="text-slate-400">⌕</span>
                {facets.map((key) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-800"
                  >
                    <span className="font-medium text-indigo-500">Type:</span>
                    {activityClass(key)?.label ?? key}
                    <button
                      type="button"
                      aria-label={`Remove ${key} filter`}
                      onClick={() => setFacets((f) => f.filter((k) => k !== key))}
                      className="text-indigo-400 hover:text-indigo-700"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onFocus={() => setDropOpen(true)}
                  placeholder="Search company, actor, activity…"
                  className="min-w-[120px] flex-1 border-none bg-transparent text-xs outline-none"
                />
                {dropOpen && (
                  <button
                    type="button"
                    onClick={() => setDropOpen(false)}
                    className="text-[11px] text-slate-400 hover:text-slate-700"
                  >
                    close
                  </button>
                )}
              </div>

              {dropOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-80 overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                  <p className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Activity type
                  </p>
                  {relevantClasses.map((cls) => {
                    const count = typeCounts[cls.key] ?? 0;
                    const on = facetSet.has(cls.key);
                    return (
                      <button
                        key={cls.key}
                        type="button"
                        onClick={() =>
                          setFacets((f) =>
                            on ? f.filter((k) => k !== cls.key) : [...f, cls.key],
                          )
                        }
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                          on ? "bg-indigo-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span className="flex-1">{cls.label}</span>
                        {/* The count is over the whole window, not the current
                            selection — otherwise it would always equal what you
                            already picked. */}
                        <span className="text-[10px] tabular-nums text-slate-400">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Date range */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              When
            </span>
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-xs">
              {DATE_RANGES.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => go({ range: key })}
                  className={`border-r border-slate-200 px-2.5 py-1.5 last:border-r-0 ${
                    range === key
                      ? "bg-indigo-600 font-semibold text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {DATE_RANGE_LABEL[key]}
                </button>
              ))}
            </div>
            {range === "custom" && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600">
                <input
                  type="date"
                  defaultValue={customFrom ?? ""}
                  onChange={(e) => go({ from: e.target.value || null })}
                  className="border-none bg-transparent text-xs outline-none"
                />
                →
                <input
                  type="date"
                  defaultValue={customTo ?? ""}
                  onChange={(e) => go({ to: e.target.value || null })}
                  className="border-none bg-transparent text-xs outline-none"
                />
              </span>
            )}
          </div>

          <SearchCount result={searched} noun="events" />
        </div>

        {/* Folds */}
        <div>
          {visibleGroups.map((group) => {
            const open = searching || !collapsed.has(group.stage);
            const lead = leadOf.get(group.stage) ?? null;
            const people = assigneesOf.get(group.stage) ?? [];
            return (
              <div key={group.stage} className="border-b border-slate-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) => {
                      const next = new Set(c);
                      if (next.has(group.stage)) next.delete(group.stage);
                      else next.add(group.stage);
                      return next;
                    })
                  }
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50"
                >
                  <span
                    className={`inline-block h-2 w-2 shrink-0 border-b-2 border-r-2 border-slate-400 transition-transform ${
                      open ? "rotate-45" : "-rotate-45"
                    }`}
                  />
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${stagePillClass(group.stage)}`}
                  >
                    {activityStageLabel(group.stage)}
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums">
                    {group.items.length}
                  </span>
                  <span className="flex-1 truncate text-[11.5px] text-slate-500">
                    {people.length
                      ? `${people.map((p) => p.name).join(", ")}${lead ? ` · ${lead} leads` : " · no lead"}`
                      : "Nobody assigned — falls back to super_admins"}
                  </span>
                  {!people.length && (
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-red-700">
                      Unassigned
                    </span>
                  )}
                </button>

                {open && (
                  <div className="pb-3 pl-9 pr-4">
                    {group.items.length === 0 ? (
                      <p className="py-2 text-xs text-slate-400">
                        Nothing recorded in this stage for the selected window.
                      </p>
                    ) : (
                      group.items.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-start gap-2.5 border-b border-slate-50 py-2 last:border-b-0 ${
                            seen.has(item.id) ? "opacity-55" : ""
                          }`}
                        >
                          <span
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: SEVERITY_DOT[item.severity] ?? "#64748B" }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[12.6px] text-slate-900">
                              {item.actorName && (
                                <span className="font-semibold">
                                  <Highlight text={item.actorName} query={typed} />{" "}
                                </span>
                              )}
                              <Highlight text={item.title} query={typed} />
                              {item.companyName && (
                                <>
                                  {" · "}
                                  <span className="font-semibold">
                                    <Highlight text={item.companyName} query={typed} />
                                  </span>
                                </>
                              )}
                            </p>
                            {item.description && (
                              <p className="mt-0.5 text-[11.3px] text-slate-500">
                                <Highlight text={item.description} query={typed} />
                              </p>
                            )}
                          </div>
                          {item.companyId && (
                            <Link
                              href={`/admin/companies/${item.companyId}`}
                              className="shrink-0 text-[11px] text-indigo-600 hover:underline"
                            >
                              Open
                            </Link>
                          )}
                          <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400">
                            {relativeTime(item.createdAt)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {searched.active && searched.rows.length === 0 && (
          <div className="px-4 pb-4">
            <NoSearchMatches
              query={typed}
              fields={["company", "actor", "activity", "detail", "stage"]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
