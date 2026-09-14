/**
 * Bulk actions for the Contacts selection bar (Odoo "Actions" menu).
 *   POST { op: "set_lead_source", value, mode, ids? | params?, group? } → { count, remaining }
 *   POST { op: "export", mode, ids? | params?, group? }                → text/csv (admin only)
 * Lead assign keeps its own route (super-admin, audited). Target resolution is shared —
 * see src/lib/sales/bulk-targets.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { mergeOverrides } from "@/lib/sales/overrides";
import { chunk } from "@/lib/supabase/paged";
import { resolveContactIds, toCsv, MAX_BULK_TARGET } from "@/lib/sales/bulk-targets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const target = {
  mode: z.enum(["ids", "filter"]),
  ids: z.array(z.string().uuid()).max(MAX_BULK_TARGET).optional(),
  params: z.string().max(4000).optional(),
  group: z.string().max(40).optional(),
};
const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_lead_source"), value: z.string().trim().min(1).max(60), afterId: z.string().uuid().optional(), ...target }),
  z.object({ op: z.literal("export"), ...target }),
]);

/** One RPC per row; bounded so a request stays inside the function limit. The client loops. */
const WRITE_CONCURRENCY = 8;
const MAX_WRITES_PER_RUN = 1500;

const EXPORT_HEADER = ["Name", "Company", "Type", "Investor type", "Email", "Phone", "Country", "Lead source", "Created on"];

function leadSourceOf(overrides: Record<string, unknown> | null, raw: Record<string, unknown> | null): string {
  const ov = overrides?.lead_source;
  if (typeof ov === "string" && ov.trim()) return ov.trim();
  const ls = (raw?.__profile as { leadSource?: unknown } | undefined)?.leadSource;
  return typeof ls === "string" ? ls.trim() : "";
}
function investorTypesOf(overrides: Record<string, unknown> | null, raw: Record<string, unknown> | null): string[] {
  const ov = overrides?.["Investor type"];
  if (Array.isArray(ov) && ov.length) return ov.map(String);
  const t = (raw?.__profile as { investorTypes?: unknown } | undefined)?.investorTypes;
  return Array.isArray(t) ? t.map(String) : [];
}

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = serviceRoleClientUntyped();
  let ids: string[];
  try {
    ids = await resolveContactIds(db, body.mode === "ids" ? { mode: "ids", ids: body.ids } : { mode: "filter", params: body.params, group: body.group });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't resolve the selection." }, { status: 500 });
  }
  if (ids.length === 0) return NextResponse.json({ error: "No contacts matched." }, { status: 400 });

  if (body.op === "export") {
    if (profile.role !== "admin") return NextResponse.json({ error: "Only an admin can export contacts." }, { status: 403 });
    const rows: unknown[][] = [];
    for (const part of chunk(ids)) {
      const { data, error } = await db.from("crm_contacts")
        .select("id, name, company, contact_type, email, phone, country, created_on, overrides, raw")
        .in("id", part);
      if (error) return NextResponse.json({ error: "Export failed — try a smaller selection." }, { status: 500 });
      for (const r of (data ?? []) as Array<Record<string, unknown>>) {
        const ov = (r.overrides ?? null) as Record<string, unknown> | null;
        const raw = (r.raw ?? null) as Record<string, unknown> | null;
        rows.push([r.name, r.company, r.contact_type, investorTypesOf(ov, raw), r.email, r.phone, r.country, leadSourceOf(ov, raw), typeof r.created_on === "string" ? r.created_on.slice(0, 10) : ""]);
      }
    }
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(toCsv(EXPORT_HEADER, rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="contacts-${stamp}.csv"` },
    });
  }

  // set_lead_source: an override, so it survives the Odoo re-sync (same key the profile
  // page writes). Atomic per row via merge_contact_overrides — never rewrites the column.
  // Walk the (sorted) id list in slices; the client passes back `nextCursor` so a second
  // request continues instead of rewriting the first slice.
  const value = body.value;
  const afterId = body.afterId;
  const sorted = [...ids].sort();
  const pending = afterId ? sorted.filter((id) => id > afterId) : sorted;
  const todo = pending.slice(0, MAX_WRITES_PER_RUN);
  let count = 0, cursor = 0;
  async function worker() {
    while (cursor < todo.length) {
      const id = todo[cursor++];
      if (await mergeOverrides(id, { set: { lead_source: value } }, "bulk set_lead_source") !== null) count++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(WRITE_CONCURRENCY, todo.length) }, () => worker()));
  const remaining = pending.length - todo.length;
  return NextResponse.json({ ok: true, count, failed: todo.length - count, remaining, nextCursor: remaining > 0 ? todo[todo.length - 1] : null });
}
