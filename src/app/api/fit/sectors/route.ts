import { NextResponse } from "next/server";
import { offerableSectors } from "@/lib/fit/match-investors";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Network size for the /fit v2 first screen. Cached: this route runs on every
// /fit landing and a count over crm_contacts is not free.
let totalCache: { at: number; n: number } | null = null;
const TOTAL_TTL_MS = 10 * 60 * 1000;

async function networkTotal(): Promise<number | null> {
  if (totalCache && Date.now() - totalCache.at < TOTAL_TTL_MS) return totalCache.n;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const { count, error } = await db.from("crm_contacts").select("id", { count: "exact", head: true }).or("contact_type.eq.investor,module.eq.investor");
  if (error || typeof count !== "number") return totalCache?.n ?? null;
  totalCache = { at: Date.now(), n: count };
  return count;
}

// Public: the sectors offerable at Q3 — only those a gated investor actually covers.
// network_total is additive (v1 ignores it).
export async function GET(): Promise<Response> {
  const [sectors, total] = await Promise.all([
    offerableSectors().catch(() => []),
    networkTotal().catch(() => null),
  ]);
  return NextResponse.json({ sectors, network_total: total });
}
