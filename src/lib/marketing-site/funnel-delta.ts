import raw from "../../../data/funnel-delta.json";
import { containsTKTK } from "./network-stats";

/**
 * The iCapOS funnel delta (upgrade brief Step 4) — where fixing the two
 * addressable causes moves the end-to-end number. Sourced ONLY from
 * data/funnel-delta.json; both values ship as "TKTK" until supplied. Modeled,
 * not measured. loadFunnelDelta() returns null while any TKTK remains, so the
 * delta card is omitted and the build stays green until the figures land.
 */

export type FunnelDelta = { delta_range: string; assumption: string };

export function loadFunnelDelta(): FunnelDelta | null {
  return containsTKTK(raw) ? null : (raw as unknown as FunnelDelta);
}
