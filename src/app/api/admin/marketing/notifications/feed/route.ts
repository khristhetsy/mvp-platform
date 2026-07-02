import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { listFeed } from "@/lib/marketing/notifications/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  try {
    const profile = await requireRole(["admin"]);
    const url = new URL(req.url);
    const unread = url.searchParams.get("unread") === "1" || url.searchParams.get("unread") === "true";
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "30") || 30, 100);
    const before = url.searchParams.get("before") ?? undefined;
    const { items, unreadCount } = await listFeed(profile.id, { unread, limit, before });
    return NextResponse.json({ items, unreadCount });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load feed." }, { status: 500 });
  }
}
