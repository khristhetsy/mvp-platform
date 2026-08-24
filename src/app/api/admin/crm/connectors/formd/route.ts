import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getFormDStats, getFormDHealth } from "@/lib/formd/store";

export const dynamic = "force-dynamic";

/** Connector-card data: stats + health (staff read). */
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [stats, health] = await Promise.all([getFormDStats(), getFormDHealth()]);
    return NextResponse.json({ stats, health, userAgentConfigured: Boolean(process.env.SEC_USER_AGENT?.trim()) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load Form D connector." }, { status: 500 });
  }
}
