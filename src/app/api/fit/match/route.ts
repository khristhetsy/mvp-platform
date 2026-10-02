import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { matchInvestors } from "@/lib/fit/match-investors";
import { setSnapshot } from "@/lib/fit/sessions";
import { toPublicResponse } from "@/lib/fit/public-match";

export const dynamic = "force-dynamic";

const schema = z.object({
  stage: z.array(z.string().max(60)).min(1).max(10),
  raise: z.array(z.string().max(60)).min(1).max(10),
  // v2 sector chips expand to every stored spelling they cover, so allow more values.
  industry: z.array(z.string().max(120)).min(1).max(60),
  revenue: z.array(z.string().max(60)).min(1).max(10),
  investorType: z.array(z.string().max(60)).max(10).default([]),
  variant: z.enum(["v1", "v2"]).default("v1"),
});

// Public: run the founder's four answers against the gated investor set. Returns
// firm names + fit only — never contact names or emails (build-spec §6). Stamps the
// exact list displayed onto the session so match_snapshot == what was shown.
export async function POST(req: NextRequest): Promise<Response> {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Answer all four questions." }, { status: 400 });
  const { variant, ...answers } = parsed.data;
  const result = await matchInvestors(answers, { variant }).catch(() => null);
  if (!result) return NextResponse.json({ matched_count: 0, top: [], locked_count: 0, thin: true });

  const sessionId = req.cookies.get("fs_session")?.value;
  if (sessionId) await setSnapshot(sessionId, result.matched_count, result.top).catch(() => {});

  // v2: firm names are shown; contact details stay server-side. The snapshot above
  // still records exactly who was matched, for the team running the call.
  if (variant === "v2") return NextResponse.json(toPublicResponse(result, answers));
  return NextResponse.json(result);
}
