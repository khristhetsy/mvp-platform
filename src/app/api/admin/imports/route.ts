import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { listImportBatches } from "@/lib/imports/batches";

export async function GET() {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) {
    return auth.error;
  }

  const batches = await listImportBatches(auth.supabase, 25);
  return NextResponse.json({ batches });
}
