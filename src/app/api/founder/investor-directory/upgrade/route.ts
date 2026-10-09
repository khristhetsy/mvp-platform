/** Ask iCFO for more directory contact space. POST { tier } → { ok }. Admins see it on Investor Directory › Access. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import { loadTiers, requestUpgrade } from "@/lib/investor-directory/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) return auth.error;
  const parsed = z.object({ tier: z.string().min(1).max(40) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick a plan." }, { status: 400 });
  const tiers = await loadTiers();
  if (!tiers.some((t) => t.key === parsed.data.tier && t.key !== "free")) return NextResponse.json({ error: "Pick a plan." }, { status: 400 });
  try {
    await requestUpgrade(auth.profile.id, parsed.data.tier);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[investor-directory] upgrade request failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't send your request. Try again." }, { status: 500 });
  }
}
