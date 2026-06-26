import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { setSponsorOwner, findProfileIdByEmail } from "@/lib/icfo-events/sponsors";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().email().nullable() });

/** Assign (or clear) the managing owner of a sponsor by email (staff). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    if (parsed.data.email === null) {
      await setSponsorOwner(auth.supabase, id, null);
      return NextResponse.json({ ok: true, ownerId: null });
    }

    const ownerId = await findProfileIdByEmail(auth.supabase, parsed.data.email);
    if (!ownerId) {
      return NextResponse.json({ error: "No account found with that email." }, { status: 404 });
    }
    await setSponsorOwner(auth.supabase, id, ownerId);
    return NextResponse.json({ ok: true, ownerId });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to assign owner." }, { status: 500 });
  }
}
