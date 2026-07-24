import { NextResponse } from "next/server";
import {
  cronMisconfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  validateCronSecret,
} from "@/lib/notifications/cron/auth";
import { runPointsExpiry } from "@/lib/icfo-events/credits";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily iCFO Points expiry sweep. No-op unless the program is enabled and an
 *  expiry window is configured (POINTS_EXPIRY_MONTHS). */
export async function GET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();
  const result = await runPointsExpiry();
  return NextResponse.json({ ok: true, ...result });
}
