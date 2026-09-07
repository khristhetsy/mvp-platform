import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { matchInvestors } from "@/lib/fit/match-investors";
import { setSnapshot } from "@/lib/fit/sessions";

export const dynamic = "force-dynamic";

const schema = z.object({
  stage: z.string().min(1).max(60),
  raise: z.string().min(1).max(60),
  industry: z.string().min(1).max(120),
  revenue: z.string().min(1).max(60),
});

// Public: run the founder's four answers against the gated investor set. Returns
// firm names + fit only — never contact names or emails (build-spec §6). Stamps the
// exact list displayed onto the session so match_snapshot == what was shown.
export async function POST(req: NextRequest): Promise<Response> {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Answer all four questions." }, { status: 400 });
  const result = await matchInvestors(parsed.data).catch(() => null);
  if (!result) return NextResponse.json({ matched_count: 0, top: [], locked_count: 0, thin: true });

  const sessionId = req.cookies.get("fs_session")?.value;
  if (sessionId) await setSnapshot(sessionId, result.matched_count, result.top).catch(() => {});

  return NextResponse.json(result);
}
