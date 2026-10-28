/**
 * GET /api/social/reddit/callback — finish the Reddit connect flow. Verifies the signed
 * state against the cookie and session, exchanges the code, reads the username, seals
 * the refresh token, and upserts social_accounts. Lands back on Settings with ?reddit=.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { normalizeUserRole } from "@/lib/api/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { upsertRedditAccount } from "@/lib/social/accounts";
import { verifyLinkedInState } from "@/lib/social/linkedin-oauth";
import { REDDIT_STATE_COOKIE, exchangeRedditCode, fetchRedditUsername, getRedditOAuthEnv } from "@/lib/social/reddit-oauth";
import { originFromRequest } from "@/lib/social/request-origin";
import { CONNECT_META_COOKIE, applyConnectMeta, decodeConnectMeta } from "@/lib/social/account-admin";
import { FOUNDER_CONNECT_COOKIE, FOUNDER_SOCIAL_PATH } from "@/lib/social/founder-connect";
import { getFounderSocialUsage } from "@/lib/social/founder-limits";
import { logFounderSocialEvent } from "@/lib/social/activity";
import { actingBlock } from "@/lib/admin/acting-central";

export const dynamic = "force-dynamic";

function backTo(origin: string, status: string, message?: string, founderFlow = false) {
  const url = new URL(founderFlow ? FOUNDER_SOCIAL_PATH : "/admin/social", origin);
  url.searchParams.set("tab", "settings");
  url.searchParams.set("reddit", status);
  if (message) url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const actingBlocked = await actingBlock();
  if (actingBlocked) return actingBlocked;
  const requestUrl = new URL(request.url);
  const origin = originFromRequest(request);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const oauthError = requestUrl.searchParams.get("error");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(REDDIT_STATE_COOKIE)?.value;
  const meta = decodeConnectMeta(cookieStore.get(CONNECT_META_COOKIE)?.value);
  const founderFlow = cookieStore.get(FOUNDER_CONNECT_COOKIE)?.value === "1";
  cookieStore.delete(REDDIT_STATE_COOKIE);
  cookieStore.delete(CONNECT_META_COOKIE);
  cookieStore.delete(FOUNDER_CONNECT_COOKIE);
  const back = (o: string, s: string, m?: string) => backTo(o, s, m, founderFlow);

  if (oauthError) return back(origin, "error", oauthError);
  if (!code || !state) return back(origin, "error", "missing_code");

  const env = getRedditOAuthEnv(origin);
  if (!env) return back(origin, "unconfigured");

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth/sign-in", origin));
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = normalizeUserRole((profile as { role?: string } | null)?.role);
  const isStaff = role === "admin" || role === "analyst";
  if (founderFlow ? role !== "founder" : !isStaff) return back(origin, "error", "not_authorized");

  if (!storedState || storedState !== state || !verifyLinkedInState(env, state, user.id)) {
    return back(origin, "error", "invalid_state");
  }

  if (founderFlow && !(await getFounderSocialUsage(user.id).catch(() => null))?.enabled) {
    return back(origin, "error", "plan_not_included");
  }

  try {
    const token = await exchangeRedditCode(env, code);
    if (!token.refresh_token) return back(origin, "error", "no_refresh_token");
    const username = await fetchRedditUsername(token.access_token);
    const { id } = await upsertRedditAccount({ username, refreshToken: token.refresh_token, ownerId: founderFlow ? user.id : null });
    if (founderFlow) {
      await logFounderSocialEvent({ type: "founder.social_account_connected", founderId: user.id, description: `Reddit, u/${username}`, metadata: { network: "reddit", account: `u/${username}` } });
    } else {
      await applyConnectMeta(id, meta, user.id);
    }
    return back(origin, "connected", `u/${username}`);
  } catch (err) {
    return back(origin, "error", err instanceof Error ? err.message : "oauth_failed");
  }
}
