import { FEATURES, FEATURE_GROUPS, FEATURE_HREFS, appliesTo, type FeatureAudience } from "@/lib/feature-controls";
import {
  founderWorkspaceNavSectionsV2,
  investorWorkspaceNavSections,
  type WorkspaceNavItem,
  type WorkspaceNavSection,
} from "@/lib/workspace-nav";

/**
 * The Feature Controls page is organized the way each role's menu is: one card per stage, then
 * Workspace, Help and the switches that have no menu item. These builders read the real menus and
 * the feature registry, so a new menu item or switch shows up here without editing this file.
 */

/** How a row is governed. "external" = a switch managed in its own panel (Founder social media). */
export type RowKind = "switch" | "always" | "none" | "external";

export type ControlRow = {
  /** Unique within the audience (a href, or `switch:<key>` for rows with no menu item). */
  id: string;
  label: string;
  /** Menu path, or null for a switch with no menu item. */
  href: string | null;
  switchKey: string | null;
  switchLabel: string;
  kind: RowKind;
  /** The same switch also governs other rows on this page, so one switch hides several items. */
  shared: boolean;
  /** Admin cards: how many pages the switch governs. */
  pages: number;
  /** Whether the row has a "Shown in menu" checkbox. */
  menu: boolean;
};

export type ControlCard = {
  title: string;
  /** Stage cards must keep at least one item visible. */
  guard: boolean;
  rows: ControlRow[];
};

/** Pages no Feature Controls switch may ever hide. */
const ALWAYS_ON = new Set(["/founder", "/founder/settings", "/investor/dashboard", "/investor/settings"]);

/** Founder social media has its own master switch (the Founder social media panel). */
const SOCIAL_MASTER_HREF = "/founder/deploy/social";

const TOP_LEVEL = "Top level";
const NOT_IN_MENU = "Not in the menu";

const featureLabel = (key: string) => FEATURES.find((f) => f.key === key)?.label ?? key;

function keyForHref(audience: FeatureAudience, href: string): string | null {
  for (const [key, hrefs] of Object.entries(FEATURE_HREFS[audience])) {
    if (hrefs.includes(href)) return key;
  }
  return null;
}

/** Every page under a menu item: a group contributes its children, deduplicated by href. */
function leaves(items: WorkspaceNavItem[]): { label: string; href: string }[] {
  const out: { label: string; href: string }[] = [];
  const seen = new Set<string>();
  const walk = (list: WorkspaceNavItem[]) => {
    for (const it of list) {
      if (it.children?.length) walk(it.children);
      else if (!seen.has(it.href)) {
        seen.add(it.href);
        out.push({ label: it.label, href: it.href });
      }
    }
  };
  walk(items);
  return out;
}

function menuRow(audience: FeatureAudience, label: string, href: string, menu: boolean): ControlRow {
  const base = { id: href, label, href, pages: 0, shared: false, menu };
  if (ALWAYS_ON.has(href)) return { ...base, switchKey: null, switchLabel: "always on", kind: "always" };
  if (audience === "founder" && href === SOCIAL_MASTER_HREF) {
    return { ...base, switchKey: null, switchLabel: "Founder social media master", kind: "external" };
  }
  const key = keyForHref(audience, href);
  if (!key) return { ...base, switchKey: null, switchLabel: "none", kind: "none" };
  return { ...base, switchKey: key, switchLabel: featureLabel(key), kind: "switch" };
}

function buildMenuCards(
  audience: "founder" | "investor",
  sections: WorkspaceNavSection[],
  stageSectionTitle: string,
): ControlCard[] {
  const cards: ControlCard[] = [];
  const top: ControlRow[] = [];
  for (const section of sections) {
    if (!section.title) {
      for (const l of leaves(section.items)) top.push(menuRow(audience, l.label, l.href, false));
    } else if (section.title === stageSectionTitle) {
      for (const stage of section.items) {
        if (!stage.children?.length) continue;
        cards.push({
          title: stage.label,
          guard: true,
          rows: leaves(stage.children).map((l) => menuRow(audience, l.label, l.href, true)),
        });
      }
    } else {
      cards.push({
        title: section.title,
        guard: false,
        rows: leaves(section.items).map((l) => menuRow(audience, l.label, l.href, true)),
      });
    }
  }
  if (top.length) cards.unshift({ title: TOP_LEVEL, guard: false, rows: top });

  // A switch with no menu item (or only an alias of one) still needs a home on the page.
  const used = new Set(cards.flatMap((c) => c.rows.map((r) => r.switchKey)).filter((k): k is string => Boolean(k)));
  const orphans = FEATURES.filter((f) => appliesTo(audience, f.key) && !used.has(f.key)).map<ControlRow>((f) => ({
    id: `switch:${f.key}`,
    label: f.label,
    href: null,
    switchKey: f.key,
    switchLabel: f.label,
    kind: "switch",
    shared: false,
    pages: FEATURE_HREFS[audience][f.key]?.length ?? 0,
    menu: false,
  }));
  if (orphans.length) cards.push({ title: NOT_IN_MENU, guard: false, rows: orphans });

  // Mark rows whose switch also governs another row on this page.
  const perKey = new Map<string, number>();
  for (const c of cards) for (const r of c.rows) if (r.switchKey) perKey.set(r.switchKey, (perKey.get(r.switchKey) ?? 0) + 1);
  for (const c of cards) for (const r of c.rows) r.shared = Boolean(r.switchKey && (perKey.get(r.switchKey) ?? 0) > 1);
  return cards;
}

export function buildFounderCards(): ControlCard[] {
  return buildMenuCards("founder", founderWorkspaceNavSectionsV2, "Your raise");
}

export function buildInvestorCards(): ControlCard[] {
  return buildMenuCards("investor", investorWorkspaceNavSections, "Your journey");
}

const ADMIN_ALWAYS_ON = ["Dashboard", "My Profile", "Profile and fields", "Feature Controls"];

/** Admin has no stages: the cards are the registry's groups, then the always on pages. */
export function buildAdminCards(): ControlCard[] {
  const cards: ControlCard[] = [];
  for (const group of FEATURE_GROUPS) {
    const rows = FEATURES.filter((f) => f.group === group && appliesTo("admin", f.key)).map<ControlRow>((f) => ({
      id: `switch:${f.key}`,
      label: f.label,
      href: null,
      switchKey: f.key,
      switchLabel: f.label,
      kind: "switch",
      shared: false,
      pages: FEATURE_HREFS.admin[f.key]?.length ?? 0,
      menu: false,
    }));
    if (rows.length) cards.push({ title: group, guard: false, rows });
  }
  cards.push({
    title: "Always on",
    guard: false,
    rows: ADMIN_ALWAYS_ON.map((label) => ({
      id: `always:${label}`,
      label,
      href: null,
      switchKey: null,
      switchLabel: "always on",
      kind: "always",
      shared: false,
      pages: 0,
      menu: false,
    })),
  });
  return cards;
}

export function buildCards(audience: FeatureAudience): ControlCard[] {
  if (audience === "founder") return buildFounderCards();
  if (audience === "investor") return buildInvestorCards();
  return buildAdminCards();
}

/** The first stage card that would be left with nothing visible, or null. */
export function emptiedStage(cards: ControlCard[], hidden: ReadonlySet<string>): string | null {
  for (const card of cards) {
    if (!card.guard || card.rows.length === 0) continue;
    if (card.rows.every((r) => r.href && hidden.has(r.href))) return card.title;
  }
  return null;
}
