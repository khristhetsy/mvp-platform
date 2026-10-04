import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getSupportSettings, saveSupportSettings } from "@/lib/support/settings";

export const dynamic = "force-dynamic";

/** Support queue, Notifications: who is notified, reminders, AI switches. Staff read; admins change. */
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  return NextResponse.json({ settings: await getSupportSettings() });
}

export async function PUT(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Only admins can change support notifications." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { settings?: unknown } | null;
  const saved = await saveSupportSettings(body?.settings, profile.id);
  if (!saved) return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });
  return NextResponse.json({ settings: saved });
}
