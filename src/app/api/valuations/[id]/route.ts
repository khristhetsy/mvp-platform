import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { getValuationWithMethods } from "@/lib/valuation/store";

export const dynamic = "force-dynamic";

// GET /api/valuations/[id] — reopen a saved valuation. RLS restricts the row to
// the founder's own organization. Returns the input snapshot + stored method rows
// so the studio reproduces exactly what was shown (spec step 7).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const result = await getValuationWithMethods(auth.supabase, id);
  if (!result) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json(result);
}
