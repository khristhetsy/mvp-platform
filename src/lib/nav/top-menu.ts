/**
 * Odoo-style top menu model. Pure functions that turn the existing sidebar nav config
 * (WorkspaceNavSection[]) into "apps" for the launcher and each app's top menu, so the
 * top menu layout never keeps a second copy of the menus. Spec: "iCapOS Top Menu Layout
 * Build Spec", sections Mapping rules and Behavior rules.
 *
 * Rules:
 *  1. A top-level item with children becomes an app; its children become the app's menu.
 *  2. A top-level item without children becomes a single-page app (no menu items).
 *  3. In a titled section, two or more leaf items are gathered into one app named after
 *     the section title. A titled section with one leaf gives that leaf its own app.
 *  4. When an app has more than MENU_GROUP_THRESHOLD menu items, items carrying a
 *     `menuGroup` are folded into a dropdown of that name. A nested group (an item with
 *     children inside an app) is always a dropdown.
 *  5. The current app is the one owning the longest href the path sits under; ties go to
 *     the app the user last opened, so Contacts opened from Sales stays inside Sales.
 */
import type { WorkspaceNavItem, WorkspaceNavSection } from "@/lib/workspace-nav";

export const MENU_GROUP_THRESHOLD = 7;

export type TopMenuLink = { kind: "link"; href: string; label: string; locked: boolean; minStage?: string };
export type TopMenuGroup = { kind: "group"; label: string; items: TopMenuLink[] };
export type TopMenuEntry = TopMenuLink | TopMenuGroup;

export type TopMenuApp = {
  /** Stable id: `${href}|${label}` for item apps, `section:${title}` for section apps. */
  id: string;
  label: string;
  /** Landing page when the app is opened from the launcher. */
  href: string;
  /** Href used to pick the app's icon (getWorkspaceNavIcon). */
  iconHref: string;
  entries: TopMenuEntry[];
  /** Every page under this app is above the founder's stage. */
  locked: boolean;
};

export type TopMenuTab = { label: string; href: string };

export type ToAppsOptions = {
  isLocked?: (item: WorkspaceNavItem) => boolean;
  /** Replace an app's menu with a hub's own tab list, keyed by the app item's href. */
  menuOverrides?: Record<string, TopMenuTab[]>;
};

const notLocked = () => false;

function toLink(item: WorkspaceNavItem, isLocked: (item: WorkspaceNavItem) => boolean): TopMenuLink {
  return { kind: "link", href: item.href, label: item.label, locked: isLocked(item), ...(item.minStage ? { minStage: item.minStage } : {}) };
}

/** Every leaf page under a list of items, depth first. */
function leaves(items: WorkspaceNavItem[], isLocked: (item: WorkspaceNavItem) => boolean): TopMenuLink[] {
  const out: TopMenuLink[] = [];
  for (const it of items) {
    if (it.children?.length) out.push(...leaves(it.children, isLocked));
    else out.push(toLink(it, isLocked));
  }
  return out;
}

/** Rule 4: an app's menu, with nested groups and (past the threshold) menuGroup dropdowns. */
export function groupMenu(items: WorkspaceNavItem[], isLocked: (item: WorkspaceNavItem) => boolean = notLocked): TopMenuEntry[] {
  const useGroups = items.length > MENU_GROUP_THRESHOLD;
  const out: TopMenuEntry[] = [];
  const groups = new Map<string, TopMenuGroup>();
  const groupFor = (label: string): TopMenuGroup => {
    let g = groups.get(label);
    if (!g) {
      g = { kind: "group", label, items: [] };
      groups.set(label, g);
      out.push(g);
    }
    return g;
  };
  for (const it of items) {
    if (it.children?.length) {
      groupFor(it.label).items.push(...leaves(it.children, isLocked));
    } else if (useGroups && it.menuGroup) {
      groupFor(it.menuGroup).items.push(toLink(it, isLocked));
    } else {
      out.push(toLink(it, isLocked));
    }
  }
  return out;
}

/** All links in an app's menu, flattened. */
export function appLinks(app: TopMenuApp): TopMenuLink[] {
  return app.entries.flatMap((e) => (e.kind === "group" ? e.items : [e]));
}

function landing(links: TopMenuLink[], fallback: string): string {
  return links.find((l) => !l.locked)?.href ?? links[0]?.href ?? fallback;
}

function appFromGroupItem(item: WorkspaceNavItem, opts: Required<Pick<ToAppsOptions, "isLocked">> & ToAppsOptions): TopMenuApp {
  const override = opts.menuOverrides?.[item.href];
  const entries: TopMenuEntry[] = override
    ? override.map((t) => ({ kind: "link", href: t.href, label: t.label, locked: false }))
    : groupMenu(item.children ?? [], opts.isLocked);
  const links = entries.flatMap((e) => (e.kind === "group" ? e.items : [e]));
  return {
    id: `${item.href}|${item.label}`,
    label: item.label,
    href: landing(links, item.href),
    iconHref: item.href,
    entries,
    locked: links.length > 0 && links.every((l) => l.locked),
  };
}

function appFromLeaf(item: WorkspaceNavItem, isLocked: (item: WorkspaceNavItem) => boolean): TopMenuApp {
  return { id: `${item.href}|${item.label}`, label: item.label, href: item.href, iconHref: item.href, entries: [], locked: isLocked(item) };
}

/** Rules 1 to 3: sections → launcher apps, in sidebar order. */
export function toApps(sections: WorkspaceNavSection[], options: ToAppsOptions = {}): TopMenuApp[] {
  const opts = { ...options, isLocked: options.isLocked ?? notLocked };
  const apps: TopMenuApp[] = [];
  for (const section of sections) {
    const leafItems = section.items.filter((i) => !i.children?.length);
    const gather = Boolean(section.title) && leafItems.length > 1;
    let gathered = false;
    for (const item of section.items) {
      if (item.children?.length) {
        apps.push(appFromGroupItem(item, opts));
      } else if (gather) {
        if (gathered) continue;
        gathered = true;
        const entries = groupMenu(leafItems, opts.isLocked);
        const links = entries.flatMap((e) => (e.kind === "group" ? e.items : [e]));
        apps.push({
          id: `section:${section.title}`,
          label: section.title as string,
          href: landing(links, item.href),
          iconHref: item.href,
          entries,
          locked: links.every((l) => l.locked),
        });
      } else {
        apps.push(appFromLeaf(item, opts.isLocked));
      }
    }
  }
  return apps;
}

function matchLength(href: string, pathname: string): number {
  return pathname === href || pathname.startsWith(`${href}/`) ? href.length : -1;
}

/** The longest href in the app that the path sits under (-1 when none). */
export function appMatch(app: TopMenuApp, pathname: string): number {
  let best = matchLength(app.href, pathname);
  for (const l of appLinks(app)) best = Math.max(best, matchLength(l.href, pathname));
  return best;
}

/** Rule 5: the app the current page belongs to, or null when no app owns the path. */
export function currentApp(apps: TopMenuApp[], pathname: string, preferredId?: string | null): TopMenuApp | null {
  let best = -1;
  let tied: TopMenuApp[] = [];
  for (const app of apps) {
    const m = appMatch(app, pathname);
    if (m < 0) continue;
    if (m > best) {
      best = m;
      tied = [app];
    } else if (m === best) {
      tied.push(app);
    }
  }
  if (!tied.length) return null;
  return tied.find((a) => a.id === preferredId) ?? tied[0];
}

/** The one menu link to highlight: the longest href the path sits under. */
export function activeHref(app: TopMenuApp, pathname: string): string | null {
  let best: string | null = null;
  for (const l of appLinks(app)) {
    if (matchLength(l.href, pathname) >= 0 && (!best || l.href.length > best.length)) best = l.href;
  }
  return best;
}
