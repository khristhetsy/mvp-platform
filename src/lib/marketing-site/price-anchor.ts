import raw from "../../../data/price-anchor.json";
import { assertNoTKTK } from "./network-stats";

/**
 * Price-anchor figures (upgrade brief Step 5) — the alternative cost of doing
 * investor outreach without iCapOS. Sourced ONLY from data/price-anchor.json;
 * all values ship as "TKTK" until supplied. No competitor names anywhere.
 * loadPriceAnchor() throws on any TKTK so the build fails loudly.
 */

export type PriceAnchor = { ir_retainer: string; list_purchase: string; placement_pct: string };

export function loadPriceAnchor(): PriceAnchor {
  assertNoTKTK(raw, "price-anchor");
  return raw as unknown as PriceAnchor;
}
