/** Shared guard for the Match campaign admin routes: flag on, admin only. */
import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { matchCampaignsEnabled } from "./flag";

export async function guardMatchAdmin() {
  if (!matchCampaignsEnabled()) {
    return { error: NextResponse.json({ error: "Match campaigns are not enabled." }, { status: 404 }) };
  }
  return requireApiProfile(["admin"]);
}

export function errorJson(err: unknown, status = 500) {
  return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status });
}
