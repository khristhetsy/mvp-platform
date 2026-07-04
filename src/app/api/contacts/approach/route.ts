import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { approachBatch } from "@/lib/approach/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // larger batches (up to 1000) need headroom

const bodySchema = z.object({ limit: z.number().int().min(1).max(1000).default(200) });

// POST /api/contacts/approach — compute approach + segment for classified rows.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  const limit = parsed.success ? parsed.data.limit : 200;

  try {
    const result = await approachBatch(limit);
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Approach scoring failed." }, { status: 500 });
  }
}
