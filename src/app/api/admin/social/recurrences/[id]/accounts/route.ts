/**
 * The series "Posts to" picker. Staff-only.
 *   PUT { accountIds } → { ok, added, removed }
 * Future, unpublished posts in the series follow the new account list; published posts stay as they are.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { setSeriesAccounts } from "@/lib/social/post-accounts";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const { id } = await params;
  const parsed = z.object({ accountIds: z.array(z.string().uuid()).min(1).max(20) }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Pick at least one account." }, { status: 400 });
  const r = await setSeriesAccounts(id, parsed.data.accountIds);
  return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: 400 });
}
