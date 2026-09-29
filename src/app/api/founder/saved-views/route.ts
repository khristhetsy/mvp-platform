/**
 * Saved views (search-bar Favorites) for the founder workspace.
 *
 * Deliberately NOT the marketing/saved-searches route: that one is staff-only and
 * returns anything marked shared. Founders are single-tenant on their own data, so
 * every read and write here is pinned to `owner_id = the caller`. There is no
 * sharing, and no way to name another founder's scope and see their views.
 *
 * Scopes are namespaced `founder:<page>` so they can never collide with a staff scope.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PREFIX = "founder:";
/** Force the namespace on, whatever the client sent. */
const scopeOf = (raw: string | null | undefined) => {
  const bare = (raw ?? "matches").replace(/^founder:/, "").slice(0, 32);
  return `${PREFIX}${bare || "matches"}`;
};

const schema = z.object({
  name: z.string().min(1).max(200),
  spec: z.object({ match: z.enum(["all", "any"]), conditions: z.array(z.any()).max(20), state: z.any().optional() }),
  scope: z.string().min(1).max(40).optional(),
  groupBy: z.string().max(60).nullish(),
  columns: z.array(z.string().max(60)).max(40).nullish(),
  isDefault: z.boolean().optional(),
  // isShared is accepted and ignored — founder views are never shared.
  isShared: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const scope = scopeOf(req.nextUrl.searchParams.get("scope"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = serviceRoleClientUntyped();

  const { data, error } = await db
    .from("marketing_saved_searches")
    .select("id, name, spec, group_by, columns, is_default")
    .eq("scope", scope)
    .eq("owner_id", auth.profile.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    searches: (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id, name: r.name, spec: r.spec, groupBy: r.group_by ?? null, columns: r.columns ?? null,
      isDefault: !!r.is_default, isShared: false, mine: true, ownerName: "You", canDelete: true,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid saved view." }, { status: 400 });
  const scope = scopeOf(parsed.data.scope);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = serviceRoleClientUntyped();

  // One default per founder per page.
  if (parsed.data.isDefault) {
    await db.from("marketing_saved_searches").update({ is_default: false })
      .eq("owner_id", auth.profile.id).eq("scope", scope).eq("is_default", true);
  }

  const { data, error } = await db.from("marketing_saved_searches").insert({
    owner_id: auth.profile.id,
    scope,
    name: parsed.data.name.trim(),
    spec: parsed.data.spec,
    group_by: parsed.data.groupBy ?? null,
    columns: parsed.data.columns ?? null,
    is_default: !!parsed.data.isDefault,
    is_shared: false,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
