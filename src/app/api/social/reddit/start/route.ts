import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createLinkedInState, linkedInStateCookieOptions } from "@/lib/social/linkedin-oauth";
import { REDDIT_STATE_COOKIE, buildRedditAuthorizeUrl, getRedditOAuthEnv } from "@/lib/social/reddit-oauth";
import { originFromRequest } from "@/lib/social/request-origin";
import { CONNECT_META_COOKIE, encodeConnectMeta, type ConnectMeta } from "@/lib/social/account-admin";

export const dynamic = "force-dynamic";

/** Start the Reddit OAuth round-trip. Optional query: label, assign, default=1. */
export async function GET(request: Request) {
  const profile = await requireRole(["admin", "analyst"]);
  const origin = originFromRequest(request);
  const env = getRedditOAuthEnv(origin);
  if (!env) return NextResponse.redirect(new URL("/admin/social?tab=settings&reddit=unconfigured", origin));

  const sp = new URL(request.url).searchParams;
  const meta: ConnectMeta = { label: sp.get("label"), assignedTo: sp.get("assign"), isDefault: sp.get("default") === "1" };
  const state = createLinkedInState(env, profile.id);
  const cookieStore = await cookies();
  cookieStore.set(REDDIT_STATE_COOKIE, state, linkedInStateCookieOptions());
  cookieStore.set(CONNECT_META_COOKIE, encodeConnectMeta(meta), linkedInStateCookieOptions());
  return NextResponse.redirect(buildRedditAuthorizeUrl(env, state));
}
