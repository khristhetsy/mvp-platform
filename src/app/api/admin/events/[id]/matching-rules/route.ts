import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { loadMatchingRules, saveMatchingRules } from "@/lib/icfo-events/introductions-server";
import { PAIR_TYPES, type PairTypeKey } from "@/lib/icfo-events/pair-types";

export const dynamic = "force-dynamic";

const schema = z.object({
  pairTypes: z.array(z.string()).max(PAIR_TYPES.length * 2),
});

/** Which pairings this event matches. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ pairTypes: await loadMatchingRules(id) });
}

/**
 * Save the pairings.
 *
 * Unknown keys are dropped rather than rejected — a stale tab should not be
 * able to widen what an event matches, and should not fail loudly either.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const result = await saveMatchingRules(id, parsed.data.pairTypes as PairTypeKey[], auth.profile.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, pairTypes: result.saved });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't save the rules." }, { status: 500 });
  }
}
