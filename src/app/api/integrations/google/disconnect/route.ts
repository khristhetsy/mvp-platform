import { NextResponse } from "next/server";
import { deleteGoogleConnectedAccount } from "@/lib/integrations/connected-accounts";
import { isGoogleOAuthConfigured } from "@/lib/integrations/google-oauth";
import { notifyGoogleAccountDisconnected } from "@/lib/notifications/google-events";
import { requireRole } from "@/lib/supabase/auth";

export async function POST() {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json({ error: "Google OAuth is not configured." }, { status: 503 });
  }

  const profile = await requireRole(["founder", "investor"]);
  const result = await deleteGoogleConnectedAccount(profile.id);

  if (result.error) {
    return NextResponse.json({ error: "Unable to disconnect Google account." }, { status: 400 });
  }

  void notifyGoogleAccountDisconnected({ userId: profile.id });

  return NextResponse.json({ disconnected: true });
}
