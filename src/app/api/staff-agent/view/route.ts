import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimitAsync } from "@/lib/ai-site/ratelimit";
import { clientIp } from "@/lib/ir-agent/ai";
import { STAFF_KEYS, recordStaffView } from "@/lib/ir-agent/staff-agents";

export const runtime = "edge";

const schema = z.object({
  page: z.enum(STAFF_KEYS),
  sessionId: z.string().min(6).max(80),
  source: z.string().max(120).nullable().optional(),
});

/**
 * Records that a visitor opened one of the staff chat pages. Public, so it is rate
 * limited, and it writes nothing about the visitor beyond a random session id and
 * the link tag that brought them.
 */
export async function POST(req: Request): Promise<Response> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const limit = await checkRateLimitAsync({ ip: clientIp(req), sessionId: `staffview:${parsed.data.sessionId}` });
  if (!limit.ok) {
    return NextResponse.json({ ok: false }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
  }

  await recordStaffView(parsed.data.page, parsed.data.sessionId, parsed.data.source ?? null);
  return NextResponse.json({ ok: true });
}
