import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { findAccountByEmail } from "@/lib/icfo-events/account-lookup";

export const dynamic = "force-dynamic";

/**
 * Event registration: does this email have an account?
 *
 * Returns only a masked address, and is rate limited, because the answer tells
 * a stranger that an email is registered.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const rl = checkRateLimit({ key: `event-account-check:${ip}`, limit: 20, windowMs: 10 * 60_000 });
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email : "";
  const found = await findAccountByEmail(email).catch(() => null);
  return NextResponse.json(found ? { found: true, masked: found.masked } : { found: false });
}
