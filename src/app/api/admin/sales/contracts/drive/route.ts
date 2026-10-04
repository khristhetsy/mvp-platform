import { NextResponse } from "next/server";
import { requireContractsApi } from "@/lib/contracts/access";
import { driveStatus, DRIVE_ROOT_FOLDER } from "@/lib/contracts/drive";

export const dynamic = "force-dynamic";

/** GET — whether the caller can save executed copies to their Google Drive. */
export async function GET(): Promise<Response> {
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  const status = await driveStatus(auth.actor.userId);
  return NextResponse.json({ ...status, root: DRIVE_ROOT_FOLDER });
}
