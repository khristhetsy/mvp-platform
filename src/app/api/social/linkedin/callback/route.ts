/**
 * GET /api/social/linkedin/callback — finish the connect flow (build-spec §9).
 * Verifies the signed state against the cookie + session, exchanges the code, reads
 * the member URN, seals tokens, and upserts social_accounts. Always lands the user
 * back on /admin/social with a ?linkedin= status the page turns into a banner.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { normalizeUserRole } from "@/lib/api/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { upsertLinkedInAccount } from "@/lib/social/accounts";
import {
  exchangeLinkedInCode,
  fetchLinkedInMember,
  getLinkedInOAuthEnv,
  LINKEDIN_STATE_COOKIE,
  tokenExpiresAt,
  verifyLinkedInState,
} from "@/lib/social/linkedin-oauth";
import { originFromRequest } from "@/lib/social/request-origin";
import { CONNECT_META_COOKIE, applyConnectMeta, decodeConnectMeta } from "@/lib/social/account-admin";
import { FOUNDER_CONNECT_COOKIE, FOUNDER_SOCIAL_PATH } from "@/lib/social/founder-connect";
import { getFounderSocialUsage } from "@/lib/social/founder-limits";
import { logFounderSocialEvent } from "@/lib/social/activity";

export const dynamic = "force-dynamic";

function backTo(origin: string, status: string, message?: string, founderFlow = false) {
  const url = new URL(founderFlow ? FOUNDER_SOCIAL_PATH : "/admin/social", origin);
  url.searchParams.set("tab", "settings");
  url.searchParams.set("linkedin", status);
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
  const storedState = cookieStore.get(LINKEDIN_STATE_COOKIE)?.value;
  const meta = decodeConnectMeta(cookieStore.get(CONNECT_META_COOKIE)?.value);
  // A founder starts this flow from /api/founder/social/connect, which sets this cookie.
  const founderFlow = cookieStore.get(FOUNDER_CONNECT_COOKIE)?.value === "1";
  cookieStore.delete(LINKEDIN_STATE_COOKIE);
  cookieStore.delete(CONNECT_META_COOKIE);
  cookieStore.delete(FOUNDER_CONNECT_COOKIE);
  const back = (o: string, s: string, m?: string) => backTo(o, s, m, founderFlow);

  // The user denied consent, or LinkedIn returned an error.
  if (oauthError) {
    return back(origin, "error", oauthErrorDesc ?? oauthError);
  }
  if (!code || !state) {
    return back(origin, "error", "missing_code");
  }

  const env = getLinkedInOAuthEnv(origin);
  if (!env) {
    return back(origin, "unconfigured");
  }

  // Must be a signed-in staff member — the same one who started the flow.
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/auth/sign-in", origin));
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = normalizeUserRole((profile as { role?: string } | null)?.role);
  const isStaff = role === "admin" || role === "analyst";
  if (founderFlow ? role !== "founder" : !isStaff) {
    return back(origin, "error", "not_authorized");
  }

  if (!storedState || storedState !== state || !verifyLinkedInState(env, state, user.id)) {
    return back(origin, "error", "invalid_state");
  }

  if (founderFlow && !(await getFounderSocialUsage(user.id).catch(() => null))?.enabled) {
    return back(origin, "error", "plan_not_included");
  }

  try {
    const token = await exchangeLinkedInCode(env, code);
    const member = await fetchLinkedInMember(token.access_token);
    const { id } = await upsertLinkedInAccount({
      memberUrn: member.memberUrn,
      displayName: member.name,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      tokenExpiresAt: tokenExpiresAt(token.expires_in),
      ownerId: founderFlow ? user.id : null,
    });
    if (founderFlow) {
      await logFounderSocialEvent({ type: "founder.social_account_connected", founderId: user.id, description: `LinkedIn${member.name ? `, ${member.name}` : ""}`, metadata: { network: "linkedin", account: member.name } });
    } else {
      await applyConnectMeta(id, meta, user.id);
    }
    return back(origin, "connected", member.name ?? undefined);
  } catch (err) {
    return back(origin, "error", err instanceof Error ? err.message : "oauth_failed");
  }
}
