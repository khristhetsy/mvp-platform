import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { getEventBySlug } from "@/lib/icfo-events/queries";
import { EVENT_SECTORS } from "@/lib/icfo-events/sectors";
import { rankMatches } from "@/lib/icfo-events/registration-matches";
import { loadMatchPool } from "@/lib/icfo-events/registration-matches-server";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

const LABELS = EVENT_SECTORS.map((s) => s.label) as [string, ...string[]];
const bodySchema = z.object({
  role: z.enum(["founder", "investor"]),
  sectors: z.array(z.enum(LABELS)).max(14),
  email: z.string().max(200).optional(),
});

/**
 * Anonymous matches for someone registering: role, type and shared sectors of
 * other registrants. Open to visitors who are not signed in, so it is rate
 * limited and never returns a name, company or contact detail.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const rl = checkRateLimit({ key: `event-matches:${ip}`, limit: 60, windowMs: 60_000 });
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (parsed.data.sectors.length === 0) return NextResponse.json({ matches: [], total: 0 });

  try {
    const { slug } = await params;
    const supabase = await createServerSupabaseClient();
    const event = await getEventBySlug(supabase, slug).catch(() => null);
    if (!event || !["published", "live", "ended"].includes(event.status)) {
      return NextResponse.json({ error: "Event not available." }, { status: 404 });
    }
    const profile = await getCurrentUserProfile().catch(() => null);
    const pool = await loadMatchPool(event.id, { profileId: profile?.id ?? null, email: parsed.data.email ?? profile?.email ?? null });
    const matches = rankMatches({ role: parsed.data.role, sectors: parsed.data.sectors }, pool);
    return NextResponse.json({ matches, total: matches.length });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Could not load matches." }, { status: 500 });
  }
}
