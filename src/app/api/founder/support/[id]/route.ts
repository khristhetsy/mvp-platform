import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getSupportThread } from "@/lib/support/support";
import { founderConfirm, founderRate } from "@/lib/support/care";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// `csat` is the original thumbs up / down, kept for any old client. `solved`
// is "Did this solve your issue?"; No reopens the request at top priority.
const schema = z.union([
  z.object({ csat: z.union([z.literal(1), z.literal(-1)]) }),
  z.object({ solved: z.boolean() }),
  z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(1000).nullish() }),
]);

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["founder"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Founders only." }, { status: 403 });
  const { id } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  // RLS restricts reads to the founder's own request.
  const thread = await getSupportThread(supabase, id);
  if (!thread || thread.request.founder_id !== profile.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  // The founder sees who has their request. Staff profiles aren't readable under
  // founder RLS, so the owner's name comes through the service role.
  let owner: { id: string; name: string } | null = null;
  if (thread.request.assigned_to) {
    const { data } = await (createServiceRoleClient() as unknown as SupabaseClient)
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", thread.request.assigned_to)
      .maybeSingle();
    const p = data as { id: string; full_name: string | null; email: string | null } | null;
    if (p) owner = { id: p.id, name: p.full_name?.trim() || p.email || "iCapOS team" };
  }
  // Internal notes are staff only. RLS already hides them; filter again here.
  const messages = thread.messages.filter((m) => !m.is_internal);
  return NextResponse.json({ ...thread, messages, owner });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["founder"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Founders only." }, { status: 403 });
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A rating is required." }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  // RLS would silently match zero rows for someone else's request; say so instead of "ok".
  const thread = await getSupportThread(supabase, id);
  if (!thread || thread.request.founder_id !== profile.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = parsed.data;
  if ("rating" in body) {
    const r = await founderRate(id, body.rating, body.comment ?? null);
    return "error" in r ? NextResponse.json({ error: r.error }, { status: 400 }) : NextResponse.json({ ok: true });
  }
  const solved = "solved" in body ? body.solved : body.csat === 1;
  const r = await founderConfirm(id, solved, "app");
  return "error" in r ? NextResponse.json({ error: r.error }, { status: 400 }) : NextResponse.json({ ok: true, status: r.status });
}
