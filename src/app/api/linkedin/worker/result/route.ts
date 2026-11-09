import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSender } from "@/lib/linkedin/worker-auth";
import { recordResult } from "@/lib/linkedin/worker-store";

export const dynamic = "force-dynamic";

const schema = z.object({
  targetId: z.string().uuid(),
  outcome: z.enum(["sent", "message_sent", "dry_run", "already_connected", "not_connected", "not_found", "failed", "warning"]),
  detail: z.string().max(300).nullable().optional(),
});

/** POST: the sender reports what happened. A warning pauses the whole account. */
export async function POST(request: Request) {
  const auth = await requireSender(request);
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid result." }, { status: 400 });
  try {
    return NextResponse.json(await recordResult(auth.account, parsed.data));
  } catch (e) {
    console.error("[linkedin] worker result failed", e);
    return NextResponse.json({ error: "Could not record the result." }, { status: 500 });
  }
}
