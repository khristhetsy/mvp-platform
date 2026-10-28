import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireFounderSocial } from "@/lib/social/founder-auth";
import { FOUNDER_CONNECT_COOKIE, FOUNDER_SOCIAL_PATH } from "@/lib/social/founder-connect";
import { buildAuthorizeUrl, createLinkedInState, getLinkedInOAuthEnv, LINKEDIN_STATE_COOKIE, linkedInStateCookieOptions } from "@/lib/social/linkedin-oauth";
import { buildMetaAuthorizeUrl, createMetaState, getMetaOAuthEnv, META_STATE_COOKIE, metaStateCookieOptions } from "@/lib/social/meta-oauth";
import { REDDIT_STATE_COOKIE, buildRedditAuthorizeUrl, getRedditOAuthEnv } from "@/lib/social/reddit-oauth";
import { CONNECT_META_COOKIE, encodeConnectMeta } from "@/lib/social/account-admin";
import { originFromRequest } from "@/lib/social/request-origin";
import { actingBlock } from "@/lib/admin/acting-central";

export const dynamic = "force-dynamic";

/**
 * Start a founder's own account connection (LinkedIn, Facebook, Instagram or Reddit).
 * Uses iCFO's registered OAuth apps and the existing callbacks. The callback sees the
 * founder cookie, stores the account against this founder, and returns to their page.
 */
export async function GET(request: Request) {
  const actingBlocked = await actingBlock();
  if (actingBlocked) return actingBlocked;
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const origin = originFromRequest(request);
  const platform = new URL(request.url).searchParams.get("platform");
  const unconfigured = (key: string) => NextResponse.redirect(new URL(`${FOUNDER_SOCIAL_PATH}?tab=settings&${key}=unconfigured`, origin));
  const cookieStore = await cookies();

  if (platform === "linkedin") {
    const env = getLinkedInOAuthEnv(origin);
    if (!env) return unconfigured("linkedin");
    const state = createLinkedInState(env, auth.founderId);
    cookieStore.set(LINKEDIN_STATE_COOKIE, state, linkedInStateCookieOptions());
    cookieStore.set(FOUNDER_CONNECT_COOKIE, "1", linkedInStateCookieOptions());
    return NextResponse.redirect(buildAuthorizeUrl(env, state));
  }
  if (platform === "facebook" || platform === "instagram") {
    const env = getMetaOAuthEnv(origin);
    if (!env) return unconfigured("facebook");
    const state = createMetaState(env, auth.founderId);
    cookieStore.set(META_STATE_COOKIE, state, metaStateCookieOptions());
    cookieStore.set(CONNECT_META_COOKIE, encodeConnectMeta({ label: null, assignedTo: null, isDefault: false, target: platform }), metaStateCookieOptions());
    cookieStore.set(FOUNDER_CONNECT_COOKIE, "1", metaStateCookieOptions());
    return NextResponse.redirect(buildMetaAuthorizeUrl(env, state));
  }
  if (platform === "reddit") {
    const env = getRedditOAuthEnv(origin);
    if (!env) return unconfigured("reddit");
    const state = createLinkedInState(env, auth.founderId);
    cookieStore.set(REDDIT_STATE_COOKIE, state, linkedInStateCookieOptions());
    cookieStore.set(FOUNDER_CONNECT_COOKIE, "1", linkedInStateCookieOptions());
    return NextResponse.redirect(buildRedditAuthorizeUrl(env, state));
  }
  return NextResponse.redirect(new URL(`${FOUNDER_SOCIAL_PATH}?tab=settings`, origin));
}
