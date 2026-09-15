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
import { originFromRequest } from "@/lib/social/request-origin";
import { CONNECT_META_COOKIE, encodeConnectMeta } from "@/lib/social/account-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const profile = await requireRole(["admin", "analyst"]);
  const origin = originFromRequest(request);

  const env = getMetaOAuthEnv(origin);
  if (!env) {
    return NextResponse.redirect(new URL("/admin/social?facebook=unconfigured", origin));
  }

  const state = createMetaState(env, profile.id);
  const cookieStore = await cookies();
  cookieStore.set(META_STATE_COOKIE, state, metaStateCookieOptions());
  // Label / assignee / default chosen in the Add account dialog; applied after connect.
  const sp = new URL(request.url).searchParams;
  cookieStore.set(CONNECT_META_COOKIE, encodeConnectMeta({ label: sp.get("label"), assignedTo: sp.get("assign"), isDefault: sp.get("default") === "1" }), metaStateCookieOptions());

  return NextResponse.redirect(buildMetaAuthorizeUrl(env, state));
}
