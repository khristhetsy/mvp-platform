import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { testConnection } from "@/lib/formd/store";

export const dynamic = "force-dynamic";

/** Test connection (§11.1): one EDGAR index fetch (admin only). */
export async function POST(): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const result = await testConnection(process.env.SEC_USER_AGENT);
  return NextResponse.json(result);
}
