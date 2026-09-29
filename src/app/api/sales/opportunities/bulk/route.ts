/**
 * Bulk actions for the Opportunities / Pipeline selection bar (Odoo "Actions" menu).
 *   POST { op: "status", ids, status }   → { count, failed }
 *   POST { op: "stage",  ids, stageId }  → { count, failed }   (logs + stage sequences, like a single move)
 *   POST { op: "owner",  ids, ownerId }  → { count, failed }
 *   POST { op: "export", ids }           → text/csv (admin only)
 * Opportunities are fully loaded client-side, so the selection is always an id list.
 * Each row still goes through updateOpportunity so the activity log and stage-triggered
 * sequences behave exactly as a one-at-a-time edit — but 6 at a time, one request.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { updateOpportunity, listOpportunities, listOpportunitiesByIds, type UpdateOpportunityPatch } from "@/lib/sales/opportunities";
import { listAssignableStaff } from "@/lib/sales/settings";
import { toCsv } from "@/lib/sales/bulk-targets";
import { enrollOpportunities } from "@/lib/marketing/sequences";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ids = z.array(z.string().uuid()).min(1).max(5000);
const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("status"), ids, status: z.enum(["open", "won", "lost", "archived"]) }),
  z.object({ op: z.literal("stage"), ids, stageId: z.string().uuid() }),
  z.object({ op: z.literal("owner"), ids, ownerId: z.string().uuid().nullable() }),
  z.object({ op: z.literal("export"), ids }),
  z.object({ op: z.literal("enroll"), ids, sequenceId: z.string().uuid(), mode: z.enum(["preview", "commit"]) }),
]);

const CONCURRENCY = 6;
const EXPORT_HEADER = ["Opportunity", "Contact", "Email", "Stage", "Status", "Owner", "Value", "Billing", "Probability", "Expected close", "Source", "Created"];

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.data;
  const targets = [...new Set(body.ids)];

  if (body.op === "enroll") {
    try {
      const picked = (await listOpportunitiesByIds(targets)).map((o) => ({ id: o.id, contact_name: o.contact_name, contact_email: o.contact_email }));
      if (picked.length === 0) return NextResponse.json({ error: "None of the selected opportunities could be found." }, { status: 404 });
      const r = await enrollOpportunities(body.sequenceId, picked, body.mode);
      return NextResponse.json({ ok: true, ...r });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Enroll failed." }, { status: 500 });
    }
  }

  if (body.op === "export") {
    if (profile.role !== "admin") return NextResponse.json({ error: "Only an admin can export opportunities." }, { status: 403 });
    const want = new Set(targets);
    const [all, staff] = await Promise.all([listOpportunities(true), listAssignableStaff()]);
    const owner = new Map(staff.map((s) => [s.id, s.name]));
    const rows = all.filter((o) => want.has(o.id)).map((o) => [
      o.title, o.contact_name, o.contact_email, o.stage_name, o.status, o.owner_id ? owner.get(o.owner_id) ?? "" : "",
      o.value_cents == null ? "" : (o.value_cents / 100).toFixed(2), o.billing, o.probability ?? "", o.expected_close ?? "", o.source ?? "", o.created_at.slice(0, 10),
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(toCsv(EXPORT_HEADER, rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="opportunities-${stamp}.csv"` },
    });
  }

  const patch: UpdateOpportunityPatch = body.op === "status" ? { status: body.status } : body.op === "stage" ? { stageId: body.stageId } : { ownerId: body.ownerId };
  let count = 0, failed = 0, cursor = 0;
  async function worker() {
    while (cursor < targets.length) {
      const id = targets[cursor++];
      try { await updateOpportunity(id, patch, profile!.id); count++; } catch { failed++; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker()));
  return NextResponse.json({ ok: true, count, failed });
}
