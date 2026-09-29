/** Staff gate shared by the IR Hub routes: admin / analyst, else a 403 response. */
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";

export async function irStaff(): Promise<{ id: string; full_name: string | null; email: string | null; role: string } | null> {
  return requireRole(["admin", "analyst"]).catch(() => null);
}
export const forbidden = () => NextResponse.json({ error: "Staff only." }, { status: 403 });
export const failed = (e: unknown, fallback: string) => NextResponse.json({ error: e instanceof Error ? e.message : fallback }, { status: 500 });
