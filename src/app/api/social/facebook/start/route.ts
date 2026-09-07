/**
 * GET /api/social/facebook/start — begin the Facebook Page connect flow (build-spec §9).
 * Staff-only. Signs CSRF state, stores it in an httpOnly cookie, and redirects to
 * Facebook Login. Falls back to /admin/social?facebook=unconfigured when META creds
 * aren't set.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import {
  buildMetaAuthorizeUrl,
  createMetaState,
  getMetaOAuthEnv,
  META_STATE_COOKIE,
  metaStateCookieOptions,
} from "@/lib/social/meta-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const profile = await requireRole(["admin", "analyst"]);
  const origin = new URL(request.url).origin;

  const env = getMetaOAuthEnv();
  if (!env) {
    return NextResponse.redirect(new URL("/admin/social?facebook=unconfigured", origin));
  }

  const state = createMetaState(env, profile.id);
  const cookieStore = await cookies();
  cookieStore.set(META_STATE_COOKIE, state, metaStateCookieOptions());

  return NextResponse.redirect(buildMetaAuthorizeUrl(env, state));
}
