import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { buildOperationalSnapshot } from "@/lib/operations/system-snapshot";

export async function GET() {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const snapshot = await buildOperationalSnapshot();
    return NextResponse.json({ snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load operational snapshot.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
