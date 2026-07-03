import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { listActivity, logActivity } from "@/lib/crm/activity";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const externalId = decodeURIComponent(id).replace(/^mirror:/, "");
  const activity = await listActivity(externalId).catch(() => []);
  return NextResponse.json({ activity });
}

const postSchema = z.object({
  channel: z.enum(["voice", "sms", "whatsapp", "email", "note", "meeting"]),
  direction: z.enum(["outbound", "inbound"]).default("outbound"),
  summary: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const externalId = decodeURIComponent(id).replace(/^mirror:/, "");
  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Provide a channel and a summary." }, { status: 400 });
  try {
    await logActivity(externalId, { ...parsed.data, loggedBy: profile.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Log failed." }, { status: 500 });
  }
}
