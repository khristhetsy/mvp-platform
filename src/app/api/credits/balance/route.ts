import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { CREDITS_ENABLED, getBalance } from "@/lib/icfo-events/credits";

export const dynamic = "force-dynamic";

/** Current user's iCFO Points balance, for the sidebar nav badge. Reports the
 *  program-enabled flag so the client can hide the nav entry when it's off. */
export async function GET(): Promise<Response> {
  if (!CREDITS_ENABLED) return NextResponse.json({ enabled: false, balance: 0 });
  const profile = await getCurrentUserProfile().catch(() => null);
  if (!profile) return NextResponse.json({ enabled: true, balance: 0 });
  const supabase = await createServerSupabaseClient();
  const balance = await getBalance(supabase, profile.id).catch(() => 0);
  return NextResponse.json({ enabled: true, balance });
}
