import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { createPublishItem } from "@/lib/publish/store";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  channel: z.literal("email"),
  title: z.string().min(1).max(200),
  subject: z.string().min(1).max(300),
  html: z.string().min(1),
  text: z.string().optional().nullable(),
  segment: z.enum(["hot", "warm", "cold"]),
  wave: z.string().max(40).optional().nullable(),
  batch: z.number().int().min(1).max(3).optional().nullable(),
});

// POST /api/publish — create a publish item; lint runs immediately.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid publish item." }, { status: 400 });

  try {
    const item = await createPublishItem(parsed.data, profile.id);
    return NextResponse.json(item);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Create failed." }, { status: 500 });
  }
}
