import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getStoredWeights, saveStoredWeights, normalizeWeights, weightsSumToOne } from "@/lib/investor-rating/weights";
import { refreshPartnerScoreSnapshots } from "@/lib/investor-rating/snapshot";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weights = await getStoredWeights(createServiceRoleClient() as unknown as SupabaseClient<any>);
  return NextResponse.json({ weights });
}

// Save new pillar weights and recompute member snapshots with them so the scores
// on the page reflect the change immediately (time-boxed to avoid a hung request).
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const weights = normalizeWeights((body as { weights?: unknown }).weights);
  if (!weightsSumToOne(weights)) return NextResponse.json({ error: "Weights must total 100%." }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as unknown as SupabaseClient<any>;
  await saveStoredWeights(admin, weights, profile.id);

  const { refreshed } = await refreshPartnerScoreSnapshots(admin as unknown as SupabaseClient<Database>, {
    weights,
    deadlineMs: Date.now() + 25_000,
  });
  return NextResponse.json({ ok: true, recomputed: refreshed });
}
