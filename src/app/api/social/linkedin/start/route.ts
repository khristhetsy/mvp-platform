/**
 * GET /api/social/linkedin/start — begin the LinkedIn connect flow (build-spec §9).
 * Staff-only. Signs CSRF state, drops it in an httpOnly cookie, and redirects to
 * LinkedIn consent. Returns to /admin/social with ?linkedin=unconfigured when the
 * app credentials aren't set (button shouldn't reach here, but fail closed).
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import {
  buildAuthorizeUrl,
  createLinkedInState,
  getLinkedInOAuthEnv,
  LINKEDIN_STATE_COOKIE,
  linkedInStateCookieOptions,
} from "@/lib/social/linkedin-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const profile = await requireRole(["admin", "analyst"]);
  const origin = new URL(request.url).origin;

  const env = getLinkedInOAuthEnv();
  if (!env) {
    return NextResponse.redirect(new URL("/admin/social?linkedin=unconfigured", origin));
  }

  const state = createLinkedInState(env, profile.id);
  const cookieStore = await cookies();
  cookieStore.set(LINKEDIN_STATE_COOKIE, state, linkedInStateCookieOptions());

  return NextResponse.redirect(buildAuthorizeUrl(env, state));
}
