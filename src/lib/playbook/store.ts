// Upsert editorial content for one nav surface (module row + its steps + flags).
// Used by PATCH /api/admin/playbook/[navId]. Admin-only is enforced at the route.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import type { PlaybookBlock, Cadence, FlagKind } from "./types";

const db = serviceRoleClientUntyped;

export interface UpsertInput {
  block?: PlaybookBlock;
  sort_order?: number;
  role_note?: string | null;
  cadence?: Cadence;
  count_source?: string | null;
  steps?: { step_no: number; body: string }[];
  flags?: { kind: FlagKind; label: string }[];
}

export async function upsertModule(navId: string, input: UpsertInput, adminId: string): Promise<void> {
  const client = db();

  const { data: existing } = await client.from("playbook_module").select("id,block").eq("nav_id", navId).maybeSingle();

  const row: Record<string, unknown> = {
    nav_id: navId,
    block: input.block ?? existing?.block ?? "core",
    updated_at: new Date().toISOString(),
    updated_by: adminId,
  };
  if (input.sort_order !== undefined) row.sort_order = input.sort_order;
  if (input.role_note !== undefined) row.role_note = input.role_note;
  if (input.cadence !== undefined) row.cadence = input.cadence;
  if (input.count_source !== undefined) row.count_source = input.count_source;

  const { data: up, error } = await client.from("playbook_module").upsert(row, { onConflict: "nav_id" }).select("id").single();
  if (error) throw new Error(error.message);
  const moduleId = (up as { id: string }).id;

  if (input.steps) {
    await client.from("playbook_step").delete().eq("module_id", moduleId);
    const rows = input.steps
      .filter((s) => s.body.trim())
      .map((s, i) => ({ module_id: moduleId, step_no: i + 1, body: s.body }));
    if (rows.length) {
      const { error: se } = await client.from("playbook_step").insert(rows);
      if (se) throw new Error(se.message);
    }
  }

  if (input.flags) {
    await client.from("playbook_flag").delete().eq("module_id", moduleId);
    const rows = input.flags.filter((f) => f.label.trim()).map((f) => ({ module_id: moduleId, kind: f.kind, label: f.label }));
    if (rows.length) {
      const { error: fe } = await client.from("playbook_flag").insert(rows);
      if (fe) throw new Error(fe.message);
    }
  }
}
