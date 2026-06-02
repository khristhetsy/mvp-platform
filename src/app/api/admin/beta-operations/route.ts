import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { buildBetaOperationsSnapshot } from "@/lib/operations/beta-operations-snapshot";

export async function GET() {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  try {
    const snapshot = await buildBetaOperationsSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Beta operations snapshot failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
