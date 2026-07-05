import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { suggestForContact } from "@/lib/verify/suggest";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // site scrapes can be slow

const bodySchema = z.object({ contactId: z.string().uuid() });

// POST /api/prospects/suggest — suggest missing email/phone for one contact.
// Compliant cascade (company site + licensed provider); returns candidates only,
// writes nothing. The human accepts via /api/prospects/accept-suggestion.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A contactId is required." }, { status: 400 });

  try {
    const result = await suggestForContact(parsed.data.contactId);
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Suggestion failed." }, { status: 500 });
  }
}
