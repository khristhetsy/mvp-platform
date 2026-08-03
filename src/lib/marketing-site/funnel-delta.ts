import raw from "../../../data/funnel-delta.json";
import { assertNoTKTK } from "./network-stats";

/**
 * The iCapOS funnel delta (upgrade brief Step 4) — where fixing the two
 * addressable causes moves the end-to-end number. Sourced ONLY from
 * data/funnel-delta.json; both values ship as "TKTK" until supplied. Modeled,
 * not measured. loadFunnelDelta() throws on any TKTK so the build fails loudly.
 */

export type FunnelDelta = { delta_range: string; assumption: string };

export function loadFunnelDelta(): FunnelDelta {
  assertNoTKTK(raw, "funnel-delta");
  return raw as unknown as FunnelDelta;
}
