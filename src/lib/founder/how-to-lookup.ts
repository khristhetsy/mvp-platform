import { HOW_TO_GUIDES } from "@/lib/founder/how-to-guides";
import type { HowToGuideData } from "@/lib/founder/how-to-types";

function clean(path: string): string {
  const noQuery = path.split("?")[0].split("#")[0];
  return noQuery.length > 1 ? noQuery.replace(/\/+$/, "") : noQuery;
}

/** The guide for a founder route, or null. Exact match only, so a parent page's guide never shows on a child page. */
export function guideForPath(pathname: string | null | undefined): HowToGuideData | null {
  if (!pathname) return null;
  const path = clean(pathname);
  return HOW_TO_GUIDES.find((g) => g.routes.includes(path)) ?? null;
}

/** A guide that a page mounts itself (no route of its own). */
export function guideByKey(key: string): HowToGuideData | null {
  return HOW_TO_GUIDES.find((g) => g.key === key) ?? null;
}
