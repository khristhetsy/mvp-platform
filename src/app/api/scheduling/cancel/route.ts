/**
 * Public booking cancel — authorized by the signed token from the confirmation
 * email (no login). Rate-limited by IP. Idempotent: cancelling an already-cancelled
 * booking still returns ok.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { cancelBookingByToken } from "@/lib/scheduling/cancel";

export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().min(10).max(600) });

export async function POST(req: NextRequest): Promise<Response> {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const limited = await enforceRateLimit({ bucket: "scheduling-cancel-ip", subjectId: ip, limit: 20, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  const { ok } = await cancelBookingByToken(parsed.data.token, "cancel");
  if (!ok) return NextResponse.json({ error: "This cancellation link is invalid or has expired." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
