import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSender } from "@/lib/linkedin/worker-auth";
import { nextForSender } from "@/lib/linkedin/worker-store";

export const dynamic = "force-dynamic";

const schema = z.object({ dryRun: z.boolean().default(true) });

/** POST: the sender asks what to do next. The answer is one invite or a reason to wait. */
export async function POST(request: Request) {
  const auth = await requireSender(request);
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    return NextResponse.json(await nextForSender(auth.account, { dryRun: parsed.data.dryRun }));
  } catch (e) {
    console.error("[linkedin] worker next failed", e);
    return NextResponse.json({ action: "wait", reason: "paused", retryMinutes: 15 });
  }
}
