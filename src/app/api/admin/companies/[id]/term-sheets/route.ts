import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireStaffApi } from "@/lib/api/admin";
import { listTermSheets } from "@/lib/term-sheet/store";

export const dynamic = "force-dynamic";

/** Staff: read a company's term sheets for the admin workspace panel. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const termSheets = await listTermSheets(auth.supabase, id);
    return NextResponse.json({ termSheets });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load term sheets." }, { status: 500 });
  }
}
