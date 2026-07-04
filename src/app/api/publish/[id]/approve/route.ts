import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { approveAndSend } from "@/lib/publish/store";

export const dynamic = "force-dynamic";

// POST /api/publish/[id]/approve — THE FIREWALL. Human admin approval that fires
// the send. Refuses lint_flagged items and unmet deliverability gates.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Only admins can approve a send." }, { status: 403 });

  const { id } = await params;
  try {
    const result = await approveAndSend(id, profile.id);
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    // These are deliberate blocks (lint / gate) — surface the message to the admin.
    return NextResponse.json({ error: err instanceof Error ? err.message : "Send blocked." }, { status: 400 });
  }
}
