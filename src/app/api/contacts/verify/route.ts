import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { verifyBatch, verifyByIds } from "@/lib/verify/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // site scrapes can be slow

const bodySchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  contactIds: z.array(z.string().uuid()).max(100).optional(),
});

// POST /api/contacts/verify — verify + append a selected slice (contactIds) or the next batch (limit).
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  const body = parsed.success ? parsed.data : {};

  try {
    const result = body.contactIds && body.contactIds.length > 0
      ? await verifyByIds(body.contactIds)
      : await verifyBatch(body.limit ?? 40);
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Verification failed." }, { status: 500 });
  }
}
