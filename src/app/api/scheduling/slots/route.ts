import { NextRequest, NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { computeHostSlots } from "@/lib/scheduling/store";

const MAX_RANGE_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

/**
 * GET /api/scheduling/slots?host=<profileId>&from=<iso>&to=<iso>
 * Open booking slots for a host. Auth required (any signed-in user may book).
 */
export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const host = req.nextUrl.searchParams.get("host");
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!host || !from || !to) {
    return NextResponse.json({ error: "host, from and to are required." }, { status: 400 });
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
    const slots = await computeHostSlots(host, from, to);
    return NextResponse.json({ slots });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to load availability." },
      { status: 500 },
    );
  }
}
