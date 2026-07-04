import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { verifyBatch } from "@/lib/verify/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // site scrapes can be slow

const bodySchema = z.object({ limit: z.number().int().min(1).max(100).default(40) });

// POST /api/contacts/verify — run one verify + append batch.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  const limit = parsed.success ? parsed.data.limit : 40;

  try {
    const result = await verifyBatch(limit);
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Verification failed." }, { status: 500 });
  }
}
