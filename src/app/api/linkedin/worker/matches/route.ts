import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSender } from "@/lib/linkedin/worker-auth";
import { pendingMatchCheck, recordMatchCount } from "@/lib/linkedin/worker-store";

export const dynamic = "force-dynamic";

const schema = z.object({
  checkId: z.string().min(1).max(100).optional(),
  total: z.number().int().min(0).nullable().optional(),
  failed: z.boolean().optional(),
  warning: z.boolean().optional(),
  detail: z.string().max(300).nullable().optional(),
});

/** POST with no checkId: is a count waiting? POST with a checkId: here is the number LinkedIn showed. */
export async function POST(request: Request) {
  const auth = await requireSender(request);
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid report." }, { status: 400 });
  try {
    const { checkId, ...rest } = parsed.data;
    if (!checkId) return NextResponse.json({ check: await pendingMatchCheck(auth.account) });
    return NextResponse.json(await recordMatchCount(auth.account, { checkId, ...rest }));
  } catch (e) {
    console.error("[linkedin] worker matches failed", e);
    return NextResponse.json({ error: "Could not record the count." }, { status: 500 });
  }
}
