/**
 * Which part of the rating a remediation task is actually about.
 *
 * The plan and the score were built separately: the tasks are field-presence
 * and document-gap checks, the CRR is thirteen weighted factors, and nothing
 * connected them. A founder reading "address diligence risk flag" had no way to
 * know whether doing it moved their number, or which part of it.
 *
 * Pure, and deliberately conservative: a category that spans dimensions gets no
 * tag rather than a misleading one.
 */

import type { Dimension } from "@/lib/crr/profiles";
import { DIMENSION_LABEL } from "@/lib/crr/weight-sets";
import type { RemediationCategory } from "@/lib/remediation/types";

const BY_CATEGORY: Partial<Record<RemediationCategory, Dimension>> = {
  // The story investors read: description, use of funds, the deck itself.
  company_profile: "narrative",
  investor_materials: "narrative",
  documents: "narrative",
  // Revenue, burn, unit economics, deal structure.
  financials: "financial",
  // Governance, IP, exit and alignment all roll into the cap table dimension.
  governance: "capTable",
  compliance: "capTable",
  // Customers and market evidence.
  market: "traction",
  // "readiness" is the catch-all bucket and spans everything — no tag is
  // better than a wrong one.
};

export type DimensionTag = { key: Dimension; label: string };

export function dimensionForCategory(category: RemediationCategory): DimensionTag | null {
  const key = BY_CATEGORY[category];
  return key ? { key, label: DIMENSION_LABEL[key] } : null;
}

/** How many open tasks sit against each dimension, strongest first. */
export function countByDimension(
  categories: RemediationCategory[],
): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const c of categories) {
    const tag = dimensionForCategory(c);
    if (!tag) continue;
    counts.set(tag.label, (counts.get(tag.label) ?? 0) + 1);
  }
  return [...counts]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
