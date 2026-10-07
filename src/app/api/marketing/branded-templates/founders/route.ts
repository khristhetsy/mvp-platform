import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { searchFounders } from "@/lib/email/branded-prefill";

// GET ?q= — founders for the branded editor's picker: Investor Relations
// projects and iCapOS founder accounts.
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    return NextResponse.json({ founders: await searchFounders(req.nextUrl.searchParams.get("q") ?? "") });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
