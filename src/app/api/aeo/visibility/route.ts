import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getVisibility } from "@/lib/aeo/visibility";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await requireRole(["admin"]);
    const data = await getVisibility();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
