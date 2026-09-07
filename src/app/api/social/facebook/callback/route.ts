/**
 * GET /api/social/facebook/callback — finish the Page connect flow (build-spec §9).
 * Verifies signed state against the cookie + session, exchanges the code, upgrades to a
 * long-lived user token, then stores one account per managed Page. Lands back on
 * /admin/social with a ?facebook= status the page turns into a banner.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { normalizeUserRole } from "@/lib/api/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { upsertFacebookPageAccount } from "@/lib/social/accounts";
import {
  exchangeLongLivedUserToken,
  exchangeMetaCode,
  fetchManagedPages,
  getMetaOAuthEnv,
  META_STATE_COOKIE,
  verifyMetaState,
} from "@/lib/social/meta-oauth";

export const dynamic = "force-dynamic";

function back(origin: string, status: string, message?: string) {
  const url = new URL("/admin/social", origin);
  url.searchParams.set("facebook", status);
  if (message) url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const oauthError = requestUrl.searchParams.get("error");
  const oauthErrorDesc = requestUrl.searchParams.get("error_description");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(META_STATE_COOKIE)?.value;
  cookieStore.delete(META_STATE_COOKIE);

  if (oauthError) return back(origin, "error", oauthErrorDesc ?? oauthError);
  if (!code || !state) return back(origin, "error", "missing_code");

  const env = getMetaOAuthEnv();
  if (!env) return back(origin, "unconfigured");

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth/sign-in", origin));
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = normalizeUserRole((profile as { role?: string } | null)?.role);
  if (role !== "admin" && role !== "analyst") return back(origin, "error", "not_authorized");

  if (!storedState || storedState !== state || !verifyMetaState(env, state, user.id)) {
    return back(origin, "error", "invalid_state");
  }

  try {
    const shortLived = await exchangeMetaCode(env, code);
    const longLived = await exchangeLongLivedUserToken(env, shortLived);
    const pages = await fetchManagedPages(longLived);
    if (pages.length === 0) return back(origin, "no_pages");
    for (const page of pages) {
      await upsertFacebookPageAccount({ pageId: page.id, pageName: page.name, pageAccessToken: page.accessToken });
    }
    return back(origin, "connected", String(pages.length));
  } catch (err) {
    return back(origin, "error", err instanceof Error ? err.message : "oauth_failed");
  }
}
