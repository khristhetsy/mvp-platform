import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { generateMeetingSummary, publishMeetingSummary } from "@/lib/meetings/recap";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST — generate a draft meeting summary (no writes).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { sessionId } = await params;
  try {
    return NextResponse.json({ summary: await generateMeetingSummary(sessionId) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to summarize." }, { status: 500 });
  }
}

const publishSchema = z.object({ note: z.string().max(20000), decisions: z.array(z.string().max(200)).max(20).default([]) });

// PUT — publish an approved summary onto the session. CEO/Admin only.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Only the CEO/Admin can publish the summary." }, { status: 403 });
  const { sessionId } = await params;
  const parsed = publishSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  try {
    await publishMeetingSummary(sessionId, parsed.data.note, parsed.data.decisions);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to publish." }, { status: 500 });
  }
}
