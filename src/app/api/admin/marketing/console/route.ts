import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { assembleMarketingConsole } from "@/lib/playbook/assemble";

export const dynamic = "force-dynamic";

/** Marketing Daily Console — the 11 marketing modules + drift. Admin/analyst read. */
export async function GET(): Promise<Response> {
  try {
    await requireRole(["admin", "analyst"]);
    const console_ = await assembleMarketingConsole();
    return NextResponse.json(console_);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load." }, { status: 500 });
  }
}
