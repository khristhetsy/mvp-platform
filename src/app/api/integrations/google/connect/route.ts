import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildGoogleAuthorizationUrl, isGoogleOAuthConfigured } from "@/lib/integrations/google-oauth";
import {
  COOKIE_RETURN,
  COOKIE_STATE,
  createGoogleOAuthState,
  googleOAuthCookieOptions,
} from "@/lib/integrations/google-oauth-state";
import { requireRole } from "@/lib/supabase/auth";

const ALLOWED_RETURN_PATHS = new Set(["/founder/settings", "/investor/settings"]);

export async function GET(request: Request) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json({ error: "Google OAuth is not configured." }, { status: 503 });
  }

  const profile = await requireRole(["founder", "investor"]);
  const requestUrl = new URL(request.url);
  const returnTo = requestUrl.searchParams.get("returnTo") ?? defaultReturnPath(profile.role);

  if (!ALLOWED_RETURN_PATHS.has(returnTo)) {
    return NextResponse.json({ error: "Invalid return path." }, { status: 400 });
  }

  const state = createGoogleOAuthState(profile.id);
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_STATE, state, googleOAuthCookieOptions());
  cookieStore.set(COOKIE_RETURN, returnTo, googleOAuthCookieOptions());

  const redirectUrl = buildGoogleAuthorizationUrl(state);
  return NextResponse.redirect(redirectUrl);
}

function defaultReturnPath(role: string) {
  return role === "investor" ? "/investor/settings" : "/founder/settings";
}
