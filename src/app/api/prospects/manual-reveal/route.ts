import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { logManualReveal, MANUAL_SOURCES } from "@/lib/verify/suggest";
import { LAWFUL_BASES } from "@/lib/verify/retention";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  contactId: z.string().uuid(),
  email: z.string().max(320).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  source: z.enum(MANUAL_SOURCES),
  lawfulBasis: z.enum(LAWFUL_BASES),
});

// POST /api/prospects/manual-reveal — log an email/phone revealed by hand in Kaspr, Apollo or elsewhere.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Enter an email or phone, the source and a lawful basis." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await logManualReveal({ ...parsed.data, runBy: profile.id ?? null })) });
  } catch (err) {
    Sentry.captureException(err);
    const msg = err instanceof Error ? err.message : "Save failed.";
    // Validation and policy refusals are the user's to fix, not server errors.
    const status = /valid|opted out|company inbox|lawful basis|Enter an email|not found/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
