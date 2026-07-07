// Operations Hub payload — one parallel aggregation for the whole hub page:
// surfaces+steps (nav-joined), drift, live counts, today's per-admin checks,
// settings, escalations, and computed advisory suggestions.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { assemblePlaybook } from "./assemble";
import { playbookCounts } from "./counts";
import { getHubSettings, todayInTz, hourInTz, type HubSettings } from "./hub-settings";
import { computeSuggestions, type Suggestion } from "./advisory";
import { scanOpenEscalations, scanNearBreachOnboarding, type OpenEscalation } from "@/lib/operations/escalation-scan";
import type { PlaybookBlock, PlaybookStep, PlaybookFlag, OrphanEntry, CardState } from "./types";

const db = serviceRoleClientUntyped;

export interface HubSurface {
  navId: string;
  moduleId: string | null;
  label: string;
  group: string;
  href: string;
  block: PlaybookBlock | null;
  sortOrder: number;
  cadence: string | null;
  roleNote: string | null;
  countSource: string | null;
  steps: PlaybookStep[];
  flags: PlaybookFlag[];
  state: CardState;
  pending: number | null;
  isGate: boolean;
  checkedToday: boolean;
}

export interface HubStats {
  openEscalations: number;
  urgentEscalations: number;
  queuePending: number;
  queuesClear: string[];
  runChecked: number;
  runTotal: number;
  gatesCleared: number;
  gatesTotal: number;
  complianceCritical: number | null;
}

export interface HubPayload {
  surfaces: HubSurface[];
  orphaned: OrphanEntry[];
  missingInPlaybook: Array<{ navId: string; label: string; href: string; group: string }>;
  counts: Record<string, number>;
  settings: HubSettings;
  escalations: OpenEscalation[];
  suggestions: Suggestion[];
  stats: HubStats;
  today: string;
  hourLocal: number;
}

async function moduleIdMap(): Promise<Map<string, string>> {
  try {
    const { data } = await db().from("playbook_module").select("id, nav_id");
    return new Map((data ?? []).map((r: { id: string; nav_id: string }) => [r.nav_id, r.id]));
  } catch {
    return new Map();
  }
}

export async function getTodaysCheckedSurfaceIds(adminId: string, today: string): Promise<Set<string>> {
  try {
    const { data } = await db().from("playbook_daily_checks").select("surface_id").eq("admin_id", adminId).eq("checked_on", today);
    return new Set((data ?? []).map((r: { surface_id: string }) => r.surface_id));
  } catch {
    return new Set();
  }
}

export async function setDailyCheck(adminId: string, surfaceId: string, checked: boolean, today: string): Promise<void> {
  if (checked) {
    const { error } = await db().from("playbook_daily_checks").upsert({ admin_id: adminId, surface_id: surfaceId, checked_on: today }, { onConflict: "admin_id,surface_id,checked_on" });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db().from("playbook_daily_checks").delete().eq("admin_id", adminId).eq("surface_id", surfaceId).eq("checked_on", today);
    if (error) throw new Error(error.message);
  }
}

async function complianceCritical(): Promise<number | null> {
  try {
    const { count, error } = await db().from("compliance_events").select("*", { count: "exact", head: true }).eq("severity", "critical").in("status", ["open", "escalated"]);
    return error ? null : count ?? 0;
  } catch {
    return null;
  }
}

export async function loadHubPayload(adminId: string): Promise<HubPayload> {
  const settings = await getHubSettings();
  const tz = settings.runResetTz;
  const today = todayInTz(tz);
  const hourLocal = hourInTz(tz);

  const assembled = await assemblePlaybook();
  const sources = assembled.cards.map((c) => c.content?.countSource).filter((s): s is string => Boolean(s));

  const [idMap, counts, checkedIds, escalations, nearBreach, compCritical] = await Promise.all([
    moduleIdMap(),
    playbookCounts(sources),
    getTodaysCheckedSurfaceIds(adminId, today),
    scanOpenEscalations(),
    scanNearBreachOnboarding(),
    complianceCritical(),
  ]);

  const surfaces: HubSurface[] = assembled.cards.map((c) => {
    const moduleId = idMap.get(c.navId) ?? null;
    const isGate = (c.content?.flags ?? []).some((f) => f.kind === "hard_gate");
    return {
      navId: c.navId,
      moduleId,
      label: c.label,
      group: c.group,
      href: c.href,
      block: c.content?.block ?? null,
      sortOrder: c.content?.sortOrder ?? 9999,
      cadence: c.content?.cadence ?? null,
      roleNote: c.content?.roleNote ?? null,
      countSource: c.content?.countSource ?? null,
      steps: c.content?.steps ?? [],
      flags: c.content?.flags ?? [],
      state: c.state,
      pending: c.content?.countSource ? counts[c.content.countSource] ?? null : null,
      isGate,
      checkedToday: moduleId ? checkedIds.has(moduleId) : false,
    };
  });

  const documented = surfaces.filter((s) => s.block != null);
  const missingInPlaybook = surfaces
    .filter((s) => s.state === "undocumented")
    .map((s) => ({ navId: s.navId, label: s.label, href: s.href, group: s.group }));

  const queuePending = Object.values(counts).reduce((a, b) => a + b, 0);
  const queuesClear = sources.filter((s) => (counts[s] ?? 0) === 0);
  const gates = documented.filter((s) => s.isGate);
  const stats: HubStats = {
    openEscalations: escalations.length,
    urgentEscalations: escalations.filter((e) => e.isUrgent).length,
    queuePending,
    queuesClear: [...new Set(queuesClear)],
    runChecked: documented.filter((s) => s.checkedToday).length,
    runTotal: documented.length,
    gatesCleared: gates.filter((s) => s.checkedToday).length,
    gatesTotal: gates.length,
    complianceCritical: compCritical,
  };

  const suggestions = settings.advisoryEnabled
    ? await computeSuggestions(adminId, {
        escalations,
        nearBreach,
        counts,
        gateSurfacesUnchecked: gates.filter((s) => !s.checkedToday).map((s) => ({ navId: s.navId, label: s.label, href: s.href })),
        hourLocal,
        today,
      })
    : [];

  return {
    surfaces,
    orphaned: assembled.orphaned,
    missingInPlaybook,
    counts,
    settings,
    escalations,
    suggestions,
    stats,
    today,
    hourLocal,
  };
}
