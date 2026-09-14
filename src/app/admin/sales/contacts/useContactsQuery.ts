"use client";

/**
 * The Contacts list's one data path. Every request the page makes — group rows, role
 * counts, dynamic group headers — is derived from a single FilterSpec + group-by + sort,
 * serialised once (`filter=<json>`), and answered by the same SQL function on the server.
 *
 * Declarative loading: `expanded` says which groups the user has open; `groups` says
 * which have rows. An effect reconciles the two, so there are no refs mirroring state
 * and no "remember to refetch here" call sites — changing the query clears `groups`
 * and the open ones reload themselves.
 *
 * Errors are state, not silence. A failed request sets `error` (the server's message)
 * and the page renders it where the rows would be; it never shows "no contacts".
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FilterSpec } from "@/lib/sales/contact-filter-spec";

export type LastMessage = { direction: "sent" | "reply" | "note"; text: string; at: string };
export type NextActivity = { type: string; title: string; due: string | null; state: "overdue" | "today" | "planned" | "done" | "none" };
export type SalesContact = { id: string; name: string; email: string; company: string; phone: string; source: string; type: string; country: string; createdOn: string; leadSource?: string; assignees?: string[]; lastMessage?: LastMessage | null; activity?: NextActivity | null };
export type GroupState = { rows: SalesContact[]; total: number; loading: boolean; loaded: boolean; page: number };
export type Facets = { counts: Record<string, number>; countries: { value: string; n: number }[] };
export type Sort = { key: string; dir: "asc" | "desc" };
export type DynGroup = { id: string; label: string; count: number };

export const PAGE = 50;
export const ROLE_GROUP_IDS = ["founder", "investor", "advisor", "other"] as const;

type Input = {
  spec: FilterSpec;
  groupBy: string;
  sort: Sort;
  viewAs: string | null;
  /** When set (profile grouping), only this role's group is worth loading. */
  role: string;
};

/**
 * Query-string for the current search. Also what bulk "Select all" hands to the server,
 * so it carries `viewAs` too — the action must scope exactly as the list did.
 */
export function contactsParams(spec: FilterSpec, sort: Sort, viewAs: string | null = null): string {
  const sp = new URLSearchParams();
  if (spec.conditions.length) sp.set("filter", JSON.stringify(spec));
  if (sort.key !== "name" || sort.dir !== "asc") { sp.set("sort", sort.key); sp.set("dir", sort.dir); }
  if (viewAs) sp.set("viewAs", viewAs);
  return sp.toString();
}

async function readJson(res: Response, fallback: string): Promise<Record<string, unknown>> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : `${fallback} (HTTP ${res.status})`);
  return data;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function useContactsQuery({ spec, groupBy, sort, viewAs, role }: Input) {
  const params = useDebounced(contactsParams(spec, sort, viewAs), 300);

  const [groups, setGroups] = useState<Record<string, GroupState>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [facets, setFacets] = useState<Facets>({ counts: {}, countries: [] });
  const [dynGroups, setDynGroups] = useState<DynGroup[]>([]);
  const [dynLoading, setDynLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped whenever the query changes; responses from an older query are dropped.
  const gen = useRef(0);
  const [version, setVersion] = useState(0);

  const groupFrag = useCallback((id: string) => `groupBy=${encodeURIComponent(groupBy)}&groupValue=${encodeURIComponent(id)}`, [groupBy]);

  const loadGroup = useCallback(async (id: string, page: number) => {
    const g = gen.current;
    setGroups((prev) => ({ ...prev, [id]: { rows: prev[id]?.rows ?? [], total: prev[id]?.total ?? 0, loading: true, loaded: prev[id]?.loaded ?? false, page } }));
    try {
      const res = await fetch(`/api/sales/contacts?${groupFrag(id)}&offset=${page * PAGE}&limit=${PAGE}${params ? `&${params}` : ""}`);
      const data = await readJson(res, "Couldn't load contacts");
      if (g !== gen.current) return;
      // total is -1 for a grouped page (the server skips the per-page count); the group
      // header count — same predicate — stands in for it, see `groups` below.
      setGroups((prev) => ({ ...prev, [id]: { rows: (data.contacts as SalesContact[] | undefined) ?? [], total: Number(data.total ?? -1), loading: false, loaded: true, page } }));
    } catch (e) {
      if (g !== gen.current) return;
      setError(e instanceof Error ? e.message : "Couldn't load contacts.");
      setGroups((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { rows: [], total: 0, page }), loading: false, loaded: true } }));
    }
  }, [groupFrag, params]);

  // Query changed (or a reload was requested): drop cached rows, refresh the counts.
  // Open groups refetch through the reconciler below.
  useEffect(() => {
    gen.current += 1;
    const g = gen.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- new query: reset derived state
    setError(null);
    setGroups({});
    const qs = params;
    (async () => {
      try {
        if (groupBy === "profile") {
          const data = await readJson(await fetch(`/api/sales/contacts/facets${qs ? `?${qs}` : ""}`), "Couldn't count contacts");
          if (g !== gen.current) return;
          setFacets({ counts: (data.counts as Record<string, number>) ?? {}, countries: (data.countries as Facets["countries"]) ?? [] });
          setDynGroups([]);
        } else {
          setDynLoading(true);
          const [dyn, fac] = await Promise.all([
            readJson(await fetch(`/api/sales/contacts/groups?by=${encodeURIComponent(groupBy)}${qs ? `&${qs}` : ""}`), "Couldn't compute groups"),
            // Country list (for the column filter) + role counts still come from facets.
            readJson(await fetch(`/api/sales/contacts/facets${qs ? `?${qs}` : ""}`), "Couldn't count contacts"),
          ]);
          if (g !== gen.current) return;
          setDynGroups((dyn.groups as DynGroup[] | undefined) ?? []);
          setFacets({ counts: (fac.counts as Record<string, number>) ?? {}, countries: (fac.countries as Facets["countries"]) ?? [] });
        }
      } catch (e) {
        if (g !== gen.current) return;
        setError(e instanceof Error ? e.message : "Search failed.");
        setDynGroups([]);
      } finally {
        if (g === gen.current) setDynLoading(false);
      }
    })();
  }, [params, groupBy, version]);

  // Switching the dimension collapses everything (new group ids).
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset open groups when dimension changes
  useEffect(() => { setExpanded({}); }, [groupBy]);

  // Filtering to one role opens that group so its rows are visible.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- open the filtered group
  useEffect(() => { if (role && groupBy === "profile") setExpanded((e) => (e[role] ? e : { ...e, [role]: true })); }, [role, groupBy]);

  // Reconcile: any open group without rows (and not already loading) gets fetched.
  useEffect(() => {
    if (error) return;
    for (const id of Object.keys(expanded)) {
      if (!expanded[id]) continue;
      if (groupBy === "profile" && role && id !== role) continue;
      const gs = groups[id];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- marks the group loading, then fetches
      if (!gs?.loaded && !gs?.loading) void loadGroup(id, 0);
    }
  }, [expanded, groups, groupBy, role, error, loadGroup]);

  const toggleGroup = useCallback((id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] })), []);

  // Resolve each group's total: the page's own count when the server gave one, else the
  // header count for that bucket (facets for the role groups, /groups for the rest).
  const groupsOut = useMemo(() => {
    const header = (id: string) => (groupBy === "profile" ? facets.counts[id] : dynGroups.find((g) => g.id === id)?.count) ?? 0;
    const out: Record<string, GroupState> = {};
    for (const [id, gs] of Object.entries(groups)) out[id] = gs.total >= 0 ? gs : { ...gs, total: header(id) };
    return out;
  }, [groups, groupBy, facets.counts, dynGroups]);

  // Odoo-style paging: jump to a page and REPLACE the visible rows (no append).
  const goPage = useCallback((id: string, delta: number) => {
    const gs = groupsOut[id];
    if (!gs || gs.loading) return;
    const totalPages = Math.max(1, Math.ceil(gs.total / PAGE));
    const next = Math.min(Math.max(0, gs.page + delta), totalPages - 1);
    if (next !== gs.page) void loadGroup(id, next);
  }, [groupsOut, loadGroup]);

  /** Refetch everything for the current query (after a bulk write, import, sync…). */
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { params, groups: groupsOut, expanded, facets, dynGroups, dynLoading, error, toggleGroup, goPage, reload };
}
