import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { buildLaunchReadinessSnapshot } from "@/lib/operations/launch-readiness";

export async function GET() {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  try {
    const snapshot = await buildLaunchReadinessSnapshot();
    return NextResponse.json(snapshot, { status: snapshot.readyForPrivateBeta ? 200 : 503 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Launch readiness check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
