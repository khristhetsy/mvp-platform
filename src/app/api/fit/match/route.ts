import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { matchInvestors } from "@/lib/fit/match-investors";
import { setSnapshot } from "@/lib/fit/sessions";

export const dynamic = "force-dynamic";

const schema = z.object({
  stage: z.array(z.string().max(60)).min(1).max(10),
  raise: z.array(z.string().max(60)).min(1).max(10),
  industry: z.array(z.string().max(120)).min(1).max(30),
  revenue: z.array(z.string().max(60)).min(1).max(10),
  investorType: z.array(z.string().max(60)).max(10).default([]),
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
