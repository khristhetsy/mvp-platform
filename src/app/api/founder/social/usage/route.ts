import { NextResponse } from "next/server";
import { requireFounderSocial } from "@/lib/social/founder-auth";
import { getFounderSocialUsage } from "@/lib/social/founder-limits";

export const dynamic = "force-dynamic";

// Display counter only. The limit itself is enforced in the posts route.
export async function GET(): Promise<Response> {
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  return NextResponse.json({ usage: await getFounderSocialUsage(auth.founderId) });
}
