import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { approachBatch, approachByIds } from "@/lib/approach/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // larger batches (up to 1000) need headroom

const bodySchema = z.object({
  limit: z.number().int().min(1).max(1000).optional(),
  contactIds: z.array(z.string().uuid()).max(1000).optional(),
});

// POST /api/contacts/approach — score a selected list slice (contactIds) or the next batch (limit).
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  const body = parsed.success ? parsed.data : {};

  try {
    const result = body.contactIds && body.contactIds.length > 0
      ? await approachByIds(body.contactIds)
      : await approachBatch(body.limit ?? 200);
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Approach scoring failed." }, { status: 500 });
  }
}
