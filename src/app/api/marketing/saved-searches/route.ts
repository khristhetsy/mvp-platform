/**
 * Saved searches (Odoo Favorites) for the Marketing Contacts grid. GET returns the
 * caller's own searches plus any shared ones; POST creates one (optionally marking it
 * the caller's default, which clears any prior default). Staff-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).max(200),
  spec: z.object({ match: z.enum(["all", "any"]), conditions: z.array(z.any()).max(20) }),
  groupBy: z.string().max(60).nullish(),
  columns: z.array(z.string().max(60)).max(40).nullish(),
  isDefault: z.boolean().optional(),
  isShared: z.boolean().optional(),
});

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = serviceRoleClientUntyped();
  const { data, error } = await db
    .from("marketing_saved_searches")
    .select("id, owner_id, name, spec, group_by, columns, is_default, is_shared")
    .or(`owner_id.eq.${profile.id},is_shared.eq.true`)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id, name: r.name, spec: r.spec, groupBy: r.group_by ?? null, columns: r.columns ?? null,
    isDefault: !!r.is_default, isShared: !!r.is_shared, mine: r.owner_id === profile.id,
  }));
  return NextResponse.json({ searches: rows });
}

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid saved search." }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = serviceRoleClientUntyped();

  // A user has at most one default — clear the previous one first.
  if (parsed.data.isDefault) {
    await db.from("marketing_saved_searches").update({ is_default: false }).eq("owner_id", profile.id).eq("is_default", true);
  }
  const { data, error } = await db.from("marketing_saved_searches").insert({
    owner_id: profile.id,
    name: parsed.data.name.trim(),
    spec: parsed.data.spec,
    group_by: parsed.data.groupBy ?? null,
    columns: parsed.data.columns ?? null,
    is_default: !!parsed.data.isDefault,
    is_shared: !!parsed.data.isShared,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
