import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { acceptSuggestion } from "@/lib/verify/suggest";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  contactId: z.string().uuid(),
  field: z.enum(["email", "phone"]),
  value: z.string().min(1).max(320),
  source: z.enum(["site", "profile", "web"]),
});

// POST /api/prospects/accept-suggestion — write a human-approved suggestion.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid suggestion payload." }, { status: 400 });

  try {
    await acceptSuggestion(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Accept failed." }, { status: 500 });
  }
}
