import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { loadCallListSegments, importSegmentConsent, dialableCount } from "@/lib/voice/segments";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [segments, dialable] = await Promise.all([loadCallListSegments(), dialableCount()]);
    return NextResponse.json({ segments, dialable });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Could not load segments." }, { status: 500 });
  }
}

const importSchema = z.object({
  kind: z.enum(["module", "status"]),
  value: z.string().min(1),
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
  const parsed = importSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Pick a segment, an opt-in source, a timezone, and confirm the attestation." }, { status: 400 });
  try {
    const result = await importSegmentConsent({
      kind: parsed.data.kind,
      value: parsed.data.value,
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
