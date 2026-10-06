import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { rejectSuggestion } from "@/lib/verify/suggest";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  contactId: z.string().uuid(),
  field: z.enum(["email", "phone"]),
  suggestionId: z.string().uuid().optional(),
  value: z.string().min(1).max(320).optional(),
}).refine((b) => b.suggestionId || b.value, "suggestionId or value is required");

// POST /api/prospects/reject-suggestion — dismiss a suggestion so it isn't offered again.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  try {
    await rejectSuggestion({ ...parsed.data, runBy: profile.id ?? null });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Reject failed." }, { status: 500 });
  }
}
