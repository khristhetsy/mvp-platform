/**
 * Which URLs the app can actually serve.
 *
 * A nav item is a string. Nothing checks that the string leads anywhere, so a
 * link added in the same commit as the page it points at is fine, and a link
 * added a commit early is a 404 in production that nobody sees until a person
 * clicks it. That happened with Networking Matching.
 *
 * This walks `src/app` and turns the route folders into matchable patterns so
 * a test can assert every navigation href resolves.
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** A route as the router sees it: "/admin/events/[id]/control". */
export type RoutePattern = string;

const PAGE_FILES = new Set(["page.tsx", "page.ts", "page.jsx", "page.js", "route.ts", "route.js"]);

/**
 * Every servable route under `dir`.
 *
 * Route groups — `(marketing)` — are folders that don't appear in the URL.
 * Parallel and intercepting routes (`@slot`, `(.)foo`) are skipped: they are
 * never a nav destination on their own.
 */
export function collectRoutes(dir: string, prefix = "", out: RoutePattern[] = []): RoutePattern[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }

  if (entries.some((e) => PAGE_FILES.has(e))) out.push(prefix === "" ? "/" : prefix);

  for (const entry of entries) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    if (entry.startsWith("@") || entry.startsWith("_") || entry.startsWith("(.")) continue;

    // A route group adds a folder but no URL segment.
    const isGroup = entry.startsWith("(") && entry.endsWith(")");
    collectRoutes(full, isGroup ? prefix : `${prefix}/${entry}`, out);
  }
  return out;
}

/** Path only — a nav href may carry a query string or a hash. */
export function pathOf(href: string): string {
  return href.split("#")[0].split("?")[0];
}

/**
 * Does `href` resolve to one of `routes`?
 *
 * A `[param]` segment matches any single segment; `[...rest]` matches the
 * remainder. External links and anchors are somebody else's problem and count
 * as resolved.
 */
export function routeExists(href: string, routes: RoutePattern[]): boolean {
  if (/^(https?:)?\/\//.test(href) || href.startsWith("mailto:") || href.startsWith("#")) return true;

  const path = pathOf(href);
  if (!path.startsWith("/")) return true;

  const want = path.split("/").filter(Boolean);
  return routes.some((r) => {
    const have = r.split("/").filter(Boolean);
    for (let i = 0; i < have.length; i += 1) {
      const seg = have[i];
      if (seg.startsWith("[...") || seg.startsWith("[[...")) return true;
      if (i >= want.length) return false;
      if (seg.startsWith("[")) continue;
      if (seg !== want[i]) return false;
    }
    return have.length === want.length;
  });
}

export type NavHref = { href: string; label: string };

/**
 * The hrefs declared in a nav config, with the label beside them so a failure
 * names the menu item rather than just the URL.
 */
export function scanNavHrefs(source: string): NavHref[] {
  const out: NavHref[] = [];
  // `{ href: "/x", label: "Y" }` in either order, across line breaks.
  const re = /href:\s*"([^"]+)"[^}]*?label:\s*"([^"]+)"|label:\s*"([^"]+)"[^}]*?href:\s*"([^"]+)"/g;
  for (const m of source.matchAll(re)) {
    const href = m[1] ?? m[4];
    const label = m[2] ?? m[3];
    if (href) out.push({ href, label: label ?? href });
  }
  return out;
}
