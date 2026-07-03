import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { importConsent } from "@/lib/voice/consent-import";

export const dynamic = "force-dynamic";

// Add already-in-platform contacts to the call list by recording their voice
// consent. Admin-only. The `attest` flag is a required, deliberate assertion
// that these contacts opted in to be contacted.
const bodySchema = z.object({
  identifiers: z.array(z.string().min(1)).min(1).max(5000),
  source: z.string().min(2).max(200),
  consentType: z.enum(["express", "express_written"]),
  timezone: z.string().min(3).max(60),
  jurisdiction: z.string().max(20).optional(),
  evidenceUrl: z.string().url().nullish(),
  attest: z.literal(true),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Only admins can manage the call list." }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide contacts, an opt-in source, a timezone, and confirm the attestation." }, { status: 400 });
  }

  try {
    const result = await importConsent({
      identifiers: parsed.data.identifiers,
      source: parsed.data.source,
      consentType: parsed.data.consentType,
      timezone: parsed.data.timezone,
      jurisdiction: parsed.data.jurisdiction,
      evidenceUrl: parsed.data.evidenceUrl ?? null,
    });
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Import failed." }, { status: 500 });
  }
}
