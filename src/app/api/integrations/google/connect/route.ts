import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildGoogleAuthorizationUrl, DRIVE_FILE_SCOPE, isGoogleOAuthConfigured } from "@/lib/integrations/google-oauth";
import {
  COOKIE_RETURN,
  COOKIE_STATE,
  createGoogleOAuthState,
  googleOAuthCookieOptions,
} from "@/lib/integrations/google-oauth-state";
import { requireRole } from "@/lib/supabase/auth";

const ALLOWED_RETURN_PATHS = new Set([
  "/founder/settings",
  "/investor/settings",
  "/investor/tasks",
  "/founder/tasks",
  "/admin/tasks",
  "/founder/calendar",
  "/investor/calendar",
  "/admin/calendar",
  "/admin/integrations",
  "/founder/inbox",
  "/investor/inbox",
  "/admin/inbox",
]);

export async function GET(request: Request) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json({ error: "Google OAuth is not configured." }, { status: 503 });
  }

  const profile = await requireRole(["founder", "investor", "admin", "analyst"]);
  const requestUrl = new URL(request.url);
  const returnTo = requestUrl.searchParams.get("returnTo") ?? defaultReturnPath(profile.role);

  // Sales Hub contracts (Drive for executed copies) return to the contract page.
  const contractsReturn = (profile.role === "admin" || profile.role === "analyst") && /^\/admin\/sales\/contracts(\/[0-9a-f-]{36})?$/i.test(returnTo);
  if (!ALLOWED_RETURN_PATHS.has(returnTo) && !contractsReturn) {
    return NextResponse.json({ error: "Invalid return path." }, { status: 400 });
  }

  const state = createGoogleOAuthState(profile.id);
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_STATE, state, googleOAuthCookieOptions());
  cookieStore.set(COOKIE_RETURN, returnTo, googleOAuthCookieOptions());

  const wantsDrive = requestUrl.searchParams.get("drive") === "1" && (profile.role === "admin" || profile.role === "analyst");
  const redirectUrl = buildGoogleAuthorizationUrl(state, wantsDrive ? [DRIVE_FILE_SCOPE] : []);
  return NextResponse.redirect(redirectUrl);
}

function defaultReturnPath(role: string) {
  if (role === "investor") return "/investor/settings";
  if (role === "admin" || role === "analyst") return "/admin/tasks";
  return "/founder/settings";
}
