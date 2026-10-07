/**
 * What the iCapOS Assistant knows about the menu, built from the live navigation
 * config (src/lib/workspace-nav.ts) every time it answers. When a page is added,
 * renamed, moved or hidden in the menu, the assistant picks it up on the next
 * question with no change here.
 *
 * Pure functions only (no database, no server imports), so they can be tested.
 * The server side loader that picks the right menu for a user lives in
 * load-assistant-knowledge.ts.
 */
import { getAllStageGuides } from "@/lib/founder/stage-guides";
import { JOURNEY_STAGES, type JourneyStage } from "@/lib/founder-journey/types";
import type { WorkspaceId, WorkspaceNavItem, WorkspaceNavSection } from "@/lib/workspace-nav";
import { PAGE_NOTES } from "@/lib/assistant/page-notes";

export type MenuLeaf = {
  href: string;
  label: string;
  /** Where the page sits, outermost first (section, app, dropdown). */
  trail: string[];
  minStage?: string;
  requiresRegCf?: boolean;
};

/** Founder journey stage → the stage name founders see. Same as src/lib/activity/stages.ts. */
export const FOUNDER_STAGE_NAME: Record<JourneyStage, string> = {
  initialize: "Stage 1 – Onboarding",
  qualify: "Stage 2 – Preparation",
  deploy: "Stage 3 – Marketing",
  optimize: "Stage 4 – Closing",
};

/** Every page (leaf) in the menu with the trail that leads to it. First occurrence of an href wins. */
export function flattenNav(sections: WorkspaceNavSection[]): MenuLeaf[] {
  const out: MenuLeaf[] = [];
  const seen = new Set<string>();
  const walk = (items: WorkspaceNavItem[], trail: string[]) => {
    for (const item of items) {
      if (item.children?.length) {
        walk(item.children, [...trail, item.label]);
        continue;
      }
      if (seen.has(item.href)) continue;
      seen.add(item.href);
      out.push({
        href: item.href,
        label: item.label,
        trail: item.menuGroup ? [...trail, item.menuGroup] : trail,
        ...(item.minStage ? { minStage: item.minStage } : {}),
        ...(item.requiresRegCf ? { requiresRegCf: true } : {}),
      });
    }
  };
  for (const section of sections) walk(section.items, section.title ? [section.title] : []);
  return out;
}

/** href → one line description: Stage guide steps first, then page-notes.ts. */
export function pageDescriptions(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const guide of getAllStageGuides()) {
    for (const step of guide.steps) {
      if (!out[step.href]) out[step.href] = `${step.title}: ${step.desc}`;
    }
  }
  for (const [href, note] of Object.entries(PAGE_NOTES)) {
    if (!out[href]) out[href] = note;
  }
  return out;
}

/** The menu page the user is on: the longest href that prefixes the path. */
export function currentLeaf(leaves: MenuLeaf[], path: string | null | undefined): MenuLeaf | null {
  if (!path) return null;
  let best: MenuLeaf | null = null;
  for (const leaf of leaves) {
    const hit = path === leaf.href || path.startsWith(`${leaf.href}/`);
    if (hit && (!best || leaf.href.length > best.href.length)) best = leaf;
  }
  return best;
}

export type MenuKnowledgeInput = {
  workspace: WorkspaceId;
  sections: WorkspaceNavSection[];
  /** Hrefs hidden for this user (Feature Controls, stage menu editor, permissions). */
  hidden?: Iterable<string>;
  currentPath?: string | null;
  /** Founder journey stage, for "unlocks at" notes. Null = unknown. */
  journeyStage?: string | null;
  descriptions?: Record<string, string>;
};

function where(leaf: MenuLeaf): string {
  return [...leaf.trail, leaf.label].join(" › ");
}

/** The text block added to the assistant's instructions. */
export function buildMenuKnowledge(input: MenuKnowledgeInput): string {
  const hidden = new Set(input.hidden ?? []);
  const leaves = flattenNav(input.sections).filter((leaf) => !hidden.has(leaf.href));
  const descriptions = input.descriptions ?? pageDescriptions();
  const stageIdx = input.journeyStage ? JOURNEY_STAGES.indexOf(input.journeyStage as JourneyStage) : -1;

  const lines = leaves.map((leaf) => {
    const parts = [`- ${where(leaf)} (${leaf.href})`];
    const note = descriptions[leaf.href];
    if (note) parts.push(`: ${note}`);
    if (leaf.minStage && input.workspace === "founder") {
      const need = JOURNEY_STAGES.indexOf(leaf.minStage as JourneyStage);
      const name = FOUNDER_STAGE_NAME[leaf.minStage as JourneyStage] ?? leaf.minStage;
      if (stageIdx >= 0 && need > stageIdx) parts.push(` [locked for this founder until ${name}]`);
      else if (stageIdx < 0) parts.push(` [opens at ${name}]`);
    }
    if (leaf.requiresRegCf) parts.push(" [Reg CF offerings only]");
    return parts.join("");
  });

  const here = currentLeaf(leaves, input.currentPath);
  const header = [
    "Live menu for this user (read from the app's navigation on every question, so it is current):",
    "- Only send the user to pages in this list, using these exact names and paths. Describe where a page is with the menu trail shown (A › B › C).",
    "- If the user asks for something that is not in this list, say it is not available in their workspace rather than guessing a page.",
    "- A page marked locked can be seen in the menu but opens only when the founder reaches that stage; explain what moves them forward.",
    here ? `Current page: ${where(here)} (${here.href}).` : input.currentPath ? `Current page: ${input.currentPath}.` : "",
  ].filter(Boolean);
  return [...header, ...lines].join("\n");
}

/** Drop menu items (and their children) whose requiredPermission the user lacks. */
export function filterNavByPermission(
  sections: WorkspaceNavSection[],
  permissions: Iterable<string>,
  isSuperAdmin = false,
): WorkspaceNavSection[] {
  if (isSuperAdmin) return sections;
  const held = new Set(permissions);
  const keep = (items: WorkspaceNavItem[]): WorkspaceNavItem[] =>
    items
      .filter((item) => !item.requiredPermission || held.has(item.requiredPermission))
      .map((item) => (item.children ? { ...item, children: keep(item.children) } : item));
  return sections.map((section) => ({ ...section, items: keep(section.items) }));
}
