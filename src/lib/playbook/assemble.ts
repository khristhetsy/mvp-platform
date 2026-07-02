// The core join. Reads the live admin nav (source of which surfaces exist) and
// the playbook_* editorial content, merges them in nav order, and computes drift.
// Nav-driven order guarantees the loop matches the menu.

import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { playbookNavSurfaces, playbookNavIds } from "./nav";
import { MARKETING_SURFACES, marketingSurfaceIds, MARKETING_KEY_PREFIX } from "./marketing-nav";
import type { PlaybookNavSurface } from "./nav";
import type { AssembledPlaybook, PlaybookCard, PlaybookContent, OrphanEntry, PlaybookStep, PlaybookFlag } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): SupabaseClient<any> {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

interface ModuleRow {
  nav_id: string;
  block: PlaybookContent["block"];
  sort_order: number;
  role_note: string | null;
  cadence: PlaybookContent["cadence"];
  count_source: string | null;
  updated_at: string;
  steps: { step_no: number; body: string }[] | null;
  flags: { kind: PlaybookFlag["kind"]; label: string }[] | null;
}

function toContent(m: ModuleRow): PlaybookContent {
  const steps: PlaybookStep[] = (m.steps ?? []).slice().sort((a, b) => a.step_no - b.step_no);
  const flags: PlaybookFlag[] = (m.flags ?? []).map((f) => ({ kind: f.kind, label: f.label }));
  return {
    navId: m.nav_id,
    block: m.block,
    sortOrder: m.sort_order,
    roleNote: m.role_note,
    cadence: m.cadence,
    countSource: m.count_source,
    steps,
    flags,
    updatedAt: m.updated_at,
  };
}

async function loadModules(): Promise<ModuleRow[]> {
  const { data } = await db()
    .from("playbook_module")
    .select("nav_id,block,sort_order,role_note,cadence,count_source,updated_at,steps:playbook_step(step_no,body),flags:playbook_flag(kind,label)")
    .order("sort_order");
  return (data ?? []) as ModuleRow[];
}

function buildCards(modules: ModuleRow[], surfaces: PlaybookNavSurface[]): PlaybookCard[] {
  const byNavId = new Map(modules.map((m) => [m.nav_id, m]));
  return surfaces.map((nav) => {
    const m = byNavId.get(nav.id);
    const content = m ? toContent(m) : null;
    return {
      navId: nav.id,
      label: nav.label, // label follows the menu, always current
      group: nav.group,
      href: nav.href,
      content,
      state: !content ? "undocumented" : content.steps.length ? "ok" : "no_steps",
    };
  });
}

export async function assemblePlaybook(): Promise<AssembledPlaybook> {
  const modules = await loadModules();
  const navIds = playbookNavIds();
  const cards = buildCards(modules, playbookNavSurfaces());

  // Orphaned: editorial content whose nav_id no longer matches any menu item.
  // Marketing-console rows (mkt:*) belong to a different console — never flag them here.
  const orphaned: OrphanEntry[] = modules
    .filter((m) => !m.nav_id.startsWith(MARKETING_KEY_PREFIX) && !navIds.has(m.nav_id))
    .map((m) => ({ navId: m.nav_id, block: m.block, steps: (m.steps ?? []).length }));

  return { cards, orphaned, generatedAt: new Date().toISOString() };
}

/** The marketing-scoped console: only mkt:* modules, over the curated surface list. */
export async function assembleMarketingConsole(): Promise<AssembledPlaybook> {
  const modules = (await loadModules()).filter((m) => m.nav_id.startsWith(MARKETING_KEY_PREFIX));
  const ids = marketingSurfaceIds();
  const cards = buildCards(modules, MARKETING_SURFACES);
  const orphaned: OrphanEntry[] = modules
    .filter((m) => !ids.has(m.nav_id))
    .map((m) => ({ navId: m.nav_id, block: m.block, steps: (m.steps ?? []).length }));
  return { cards, orphaned, generatedAt: new Date().toISOString() };
}
