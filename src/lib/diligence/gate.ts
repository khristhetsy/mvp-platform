// Visibility gate (§10): which sections founders/investors may see. Service role.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { GateSection } from "./types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export type GateRow = { founder_visible: boolean; investor_visible: boolean };
export type GateMap = Record<string, GateRow>;

export const GATE_SECTIONS: GateSection[] = ["findings", "responses", "data_room", "candor", "icfo_review", "verdict"];

// §10 defaults applied at send-to-founder.
export const DEFAULT_GATE: Record<GateSection, GateRow> = {
  findings: { founder_visible: true, investor_visible: true },
  responses: { founder_visible: true, investor_visible: true },
  data_room: { founder_visible: true, investor_visible: false },
  candor: { founder_visible: false, investor_visible: false },
  icfo_review: { founder_visible: false, investor_visible: false },
  verdict: { founder_visible: false, investor_visible: true },
};

export async function loadGate(supabase: SupabaseClient<Database>, eid: string): Promise<GateMap> {
  const { data } = await raw(supabase).from("dd_visibility_gate").select("section, founder_visible, investor_visible").eq("engagement_id", eid);
  const map: GateMap = {};
  for (const r of (data ?? []) as Array<{ section: string } & GateRow>) {
    map[r.section] = { founder_visible: r.founder_visible, investor_visible: r.investor_visible };
  }
  return map;
}

/** Apply the §10 default gate (upsert all six rows). */
export async function applyDefaultGate(supabase: SupabaseClient<Database>, eid: string): Promise<void> {
  const rows = GATE_SECTIONS.map((s) => ({ engagement_id: eid, section: s, ...DEFAULT_GATE[s] }));
  await raw(supabase).from("dd_visibility_gate").upsert(rows, { onConflict: "engagement_id,section" });
}

/** Toggle one gate cell. */
export async function setGate(
  supabase: SupabaseClient<Database>,
  eid: string,
  section: GateSection,
  who: "founder" | "investor",
  visible: boolean,
): Promise<void> {
  const col = who === "founder" ? "founder_visible" : "investor_visible";
  await raw(supabase)
    .from("dd_visibility_gate")
    .upsert({ engagement_id: eid, section, [col]: visible }, { onConflict: "engagement_id,section" });
}
