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
import { upsertFacebookPageAccount, upsertInstagramAccount } from "@/lib/social/accounts";
import {
  exchangeLongLivedUserToken,
  exchangeMetaCode,
  fetchManagedPages,
  getMetaOAuthEnv,
  META_STATE_COOKIE,
  verifyMetaState,
} from "@/lib/social/meta-oauth";
import { originFromRequest } from "@/lib/social/request-origin";
import { CONNECT_META_COOKIE, applyConnectMeta, decodeConnectMeta } from "@/lib/social/account-admin";

export const dynamic = "force-dynamic";

function back(origin: string, status: string, message?: string) {
  const url = new URL("/admin/social", origin);
  url.searchParams.set("tab", "settings");
  url.searchParams.set("facebook", status);
  if (message) url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = originFromRequest(request);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const oauthError = requestUrl.searchParams.get("error");
  const oauthErrorDesc = requestUrl.searchParams.get("error_description");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(META_STATE_COOKIE)?.value;
  const meta = decodeConnectMeta(cookieStore.get(CONNECT_META_COOKIE)?.value);
  cookieStore.delete(META_STATE_COOKIE);
  cookieStore.delete(CONNECT_META_COOKIE);

  if (oauthError) return back(origin, "error", oauthErrorDesc ?? oauthError);
  if (!code || !state) return back(origin, "error", "missing_code");

  const env = getMetaOAuthEnv(origin);
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
    // The dialog's label / default go on the platform the user chose (Facebook Page or the
    // Instagram account linked to it); the assignee goes on everything that came back.
    const wantIg = meta.target === "instagram";
    let igCount = 0, labelled = false;
    for (const page of pages) {
      const { id } = await upsertFacebookPageAccount({ pageId: page.id, pageName: page.name, pageAccessToken: page.accessToken });
      const fbMeta = !wantIg && !labelled ? meta : { assignedTo: meta.assignedTo };
      if (fbMeta === meta) labelled = true;
      await applyConnectMeta(id, fbMeta, user.id);
      if (page.instagram) {
        const ig = await upsertInstagramAccount({ igUserId: page.instagram.id, username: page.instagram.username, pageAccessToken: page.accessToken });
        const igMeta = wantIg && !labelled ? meta : { assignedTo: meta.assignedTo };
        if (igMeta === meta) labelled = true;
        await applyConnectMeta(ig.id, igMeta, user.id);
        igCount++;
      }
    }
    if (wantIg && igCount === 0) return back(origin, "no_instagram");
    return back(origin, "connected", igCount ? `${pages.length} Page(s) and ${igCount} Instagram account(s)` : `${pages.length} Page(s)`);
  } catch (err) {
    return back(origin, "error", err instanceof Error ? err.message : "oauth_failed");
  }
}
