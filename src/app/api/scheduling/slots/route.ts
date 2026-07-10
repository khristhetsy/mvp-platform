import { NextRequest, NextResponse } from "next/server";
import { computeHostSlots } from "@/lib/scheduling/store";

const MAX_RANGE_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

/**
 * GET /api/scheduling/slots?host=<profileId>&from=<iso>&to=<iso>
 * Open booking slots for a host. Public — powers the guest booking page (only
 * exposes open time slots, not event details).
 */
export async function GET(req: NextRequest): Promise<Response> {
  const host = req.nextUrl.searchParams.get("host");
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const durationRaw = req.nextUrl.searchParams.get("duration");
  const duration = durationRaw ? Number(durationRaw) : undefined;
  if (!host || !from || !to) {
    return NextResponse.json({ error: "host, from and to are required." }, { status: 400 });
  }
  if (durationRaw && (!Number.isFinite(duration) || (duration as number) < 5 || (duration as number) > 480)) {
    return NextResponse.json({ error: "Invalid duration." }, { status: 400 });
  }

  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    return NextResponse.json({ error: "Invalid range." }, { status: 400 });
  }
  if (toMs - fromMs > MAX_RANGE_MS) {
    return NextResponse.json({ error: "Range too large (max 60 days)." }, { status: 400 });
  }

  try {
    const slots = await computeHostSlots(host, from, to, duration);
    return NextResponse.json({ slots });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to load availability." },
      { status: 500 },
    );
  }
}
