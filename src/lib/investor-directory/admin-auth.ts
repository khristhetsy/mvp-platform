import "server-only";
import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";

/** Investor directory admin routes: admin role only. */
export async function directoryAdmin(): Promise<{ adminId: string } | { error: NextResponse }> {
  const auth = await requireApiProfile(["admin"]);
  if ("error" in auth && auth.error) return { error: auth.error };
  return { adminId: auth.profile.id };
}

export function failed(err: unknown, fallback: string): NextResponse {
  const msg = err instanceof Error ? err.message : fallback;
  console.error("[investor-directory admin]", msg);
  return NextResponse.json({ error: msg || fallback }, { status: 400 });
}
