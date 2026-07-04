import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { classifyBatch } from "@/lib/classify/store";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ limit: z.number().int().min(1).max(500).default(100) });

// POST /api/contacts/classify — run one classification batch over unclassified rows.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  const limit = parsed.success ? parsed.data.limit : 100;

  try {
    const result = await classifyBatch(limit);
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Classification failed." }, { status: 500 });
  }
}
