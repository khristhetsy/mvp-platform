import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { applyOverride } from "@/lib/classify/store";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  contact_id: z.string().uuid(),
  side: z.enum(["founder", "investor"]),
});

// POST /api/contacts/classify/override — manual founder/investor assignment (logged).
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "contact_id and side required." }, { status: 400 });

  try {
    await applyOverride(parsed.data.contact_id, parsed.data.side, profile.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Override failed." }, { status: 500 });
  }
}
