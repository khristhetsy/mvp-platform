import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { isSuperAdmin } from "@/lib/rbac/effective-permissions";
import { listLeadAssignableStaff } from "@/lib/sales/settings";
import { applyContactFilters } from "@/lib/sales/contact-filters";

export const dynamic = "force-dynamic";

const GROUPS = ["founder", "investor", "advisor", "other"];
const MAX_TARGET = 25000; // safety cap on how many contacts one action can touch

const schema = z.object({
  memberIds: z.array(z.string().uuid()).min(1).max(50),
  mode: z.enum(["ids", "filter"]),
  ids: z.array(z.string().uuid()).max(MAX_TARGET).optional(),
  params: z.string().max(4000).optional(),
  group: z.string().max(40).optional(),
});

// POST /api/sales/contacts/bulk-assign — add members to assignee_ids across many
// contacts. Super admin only (Lead assign edits are super-admin-only elsewhere too).
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  if (!isSuperAdmin(profile)) return NextResponse.json({ error: "Only a super admin can mass-assign contacts." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { memberIds, mode } = parsed.data;

  // Only lead-assignable members may be assigned.
  const eligible = new Set((await listLeadAssignableStaff()).map((s) => s.id));
  const members = [...new Set(memberIds.filter((id) => eligible.has(id)))];
  if (members.length === 0) return NextResponse.json({ error: "None of the selected members are lead-assignable." }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = serviceRoleClientUntyped();

  // Resolve the target contact ids.
  let ids: string[] = [];
  if (mode === "ids") {
    ids = [...new Set(parsed.data.ids ?? [])];
  } else {
    const p = new URLSearchParams(parsed.data.params ?? "");
    const PAGE = 1000;
    for (let from = 0; from < MAX_TARGET; from += PAGE) {
      let q = db.from("crm_contacts").select("id").range(from, from + PAGE - 1);
      if (parsed.data.group && GROUPS.includes(parsed.data.group)) q = q.eq("contact_type", parsed.data.group);
      q = applyContactFilters(q, p);
      const { data, error } = await q;
      if (error || !data || data.length === 0) break;
      ids.push(...(data as Array<{ id: string }>).map((r) => r.id));
      if (data.length < PAGE) break;
    }
    ids = [...new Set(ids)];
  }
  if (ids.length === 0) return NextResponse.json({ error: "No contacts matched." }, { status: 400 });

  // Set-based union via the SQL function. Fall back to a bounded per-row union if the
  // function isn't reachable (e.g. PostgREST cache not reloaded) and the set is small.
  let count = 0;
  const { data: rpcData, error: rpcErr } = await db.rpc("sales_bulk_add_assignees", { p_member_ids: members, p_ids: ids });
  if (!rpcErr) {
    count = typeof rpcData === "number" ? rpcData : ids.length;
  } else if (ids.length <= 1000) {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data: rows } = await db.from("crm_contacts").select("id, assignee_ids").in("id", chunk);
      for (const r of (rows ?? []) as Array<{ id: string; assignee_ids: string[] | null }>) {
        const union = [...new Set([...(r.assignee_ids ?? []), ...members])];
        await db.from("crm_contacts").update({ assignee_ids: union }).eq("id", r.id);
        count++;
      }
    }
  } else {
    return NextResponse.json({ error: "Bulk update unavailable — reload the API schema cache (NOTIFY pgrst) and retry." }, { status: 503 });
  }

  await db.from("sales_bulk_assign_audit").insert({
    actor_id: profile.id,
    member_ids: members,
    contact_count: count,
    filter: mode === "filter" ? (parsed.data.params ?? "") + (parsed.data.group ? ` [group=${parsed.data.group}]` : "") : `${ids.length} selected`,
  });

  return NextResponse.json({ ok: true, count });
}
