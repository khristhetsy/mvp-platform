import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadSignature, saveSignature, sanitizeSignatureHtml, effectiveSignature, DEFAULT_ICFO_SIGNATURE } from "@/lib/email/signature";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Service-role read keyed by the authenticated profile id (avoids RLS edge cases).
  const db = createServiceRoleClient();
  const signature = await loadSignature(db, auth.profile.id);
  // `signature` = what the user saved (may be empty). `effective` = what compose
  // should actually show, falling back to the iCFO default. `default` lets the
  // settings editor offer a one-click reset to the template.
  return NextResponse.json({
    signature,
    effective: effectiveSignature(signature),
    default: DEFAULT_ICFO_SIGNATURE,
  });
}

const schema = z.object({ signature: z.string().max(20000) });

export async function PUT(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const clean = sanitizeSignatureHtml(parsed.data.signature);
  try {
    // Service-role write, scoped to the authenticated user's own profile id only.
    const db = createServiceRoleClient();
    await saveSignature(db, auth.profile.id, clean);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save signature.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
  return NextResponse.json({ signature: clean });
}
