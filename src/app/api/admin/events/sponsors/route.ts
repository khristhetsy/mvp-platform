import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { sponsorInput } from "@/lib/icfo-events/schemas";
import { createSponsor, listSponsors } from "@/lib/icfo-events/sponsors";

export const dynamic = "force-dynamic";

/** List the sponsor catalog (staff). */
export async function GET(): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sponsors = await listSponsors(auth.supabase);
    return NextResponse.json({ sponsors });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load sponsors." }, { status: 500 });
  }
}

/** Create a sponsor (staff). */
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const parsed = sponsorInput.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const sponsor = await createSponsor(auth.supabase, parsed.data);
    return NextResponse.json({ sponsor }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to create sponsor." }, { status: 500 });
  }
}
