import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import {
  buildAuthorizeUrl, createLinkedInState, getLinkedInOAuthEnv,
  LINKEDIN_STATE_COOKIE, linkedInStateCookieOptions,
} from "@/lib/social/linkedin-oauth";
import { originFromRequest } from "@/lib/social/request-origin";
import { CONNECT_META_COOKIE, encodeConnectMeta, findOpenInvite, type ConnectMeta } from "@/lib/social/account-admin";

export const dynamic = "force-dynamic";

/**
 * Start the LinkedIn OAuth round-trip. Optional query:
 *   label, assign (profile id), default=1  — applied to the account after connect
 *   invite=<token>                          — a connect-link invite; its label/assignee win
 *   fresh=1                                 — ask LinkedIn for a fresh sign-in (second account)
 */
export async function GET(request: Request) {
  const profile = await requireRole(["admin", "analyst"]);
  const origin = originFromRequest(request);
  const env = getLinkedInOAuthEnv(origin);
  if (!env) return NextResponse.redirect(new URL("/admin/social?linkedin=unconfigured", origin));

  const sp = new URL(request.url).searchParams;
  let meta: ConnectMeta = { label: sp.get("label"), assignedTo: sp.get("assign"), isDefault: sp.get("default") === "1" };
  const inviteToken = sp.get("invite");
  if (inviteToken) {
    const inv = await findOpenInvite(inviteToken);
    if (!inv) return NextResponse.redirect(new URL("/admin/social?tab=settings&linkedin=error&message=invite_expired", origin));
    meta = { label: inv.label, assignedTo: inv.assigned_to, isDefault: inv.is_default, inviteId: inv.id };
  }

  const state = createLinkedInState(env, profile.id);
  const cookieStore = await cookies();
  cookieStore.set(LINKEDIN_STATE_COOKIE, state, linkedInStateCookieOptions());
  cookieStore.set(CONNECT_META_COOKIE, encodeConnectMeta(meta), linkedInStateCookieOptions());
  return NextResponse.redirect(buildAuthorizeUrl(env, state, { freshLogin: sp.get("fresh") === "1" || Boolean(inviteToken) }));
}
