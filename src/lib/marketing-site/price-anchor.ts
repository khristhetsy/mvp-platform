import raw from "../../../data/price-anchor.json";
import { containsTKTK } from "./network-stats";

/**
 * Price-anchor figures (upgrade brief Step 5) — the alternative cost of doing
 * investor outreach without iCapOS. Sourced ONLY from data/price-anchor.json;
 * all values ship as "TKTK" until supplied. No competitor names anywhere.
 * loadPriceAnchor() returns null while any TKTK remains, so the anchor line is
 * omitted and the build stays green until the figures land.
 */

export type PriceAnchor = { ir_retainer: string; list_purchase: string; placement_pct: string };

export function loadPriceAnchor(): PriceAnchor | null {
  return containsTKTK(raw) ? null : (raw as unknown as PriceAnchor);
}
