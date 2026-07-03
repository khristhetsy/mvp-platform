import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { syncCrmToMarketing } from "@/lib/marketing/crm-sync";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ offset: z.number().int().nonnegative().default(0) });

// One bounded batch of the CRM → Marketing Hub contact sync. The client loops,
// passing back nextOffset, until done. Admin-only.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Only admins can sync contacts." }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    const page = await syncCrmToMarketing(parsed.data.offset);
    return NextResponse.json(page);
  } catch (err) {
    Sentry.captureException(err);
    const msg = err instanceof Error ? err.message : (typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : "Sync failed.");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
