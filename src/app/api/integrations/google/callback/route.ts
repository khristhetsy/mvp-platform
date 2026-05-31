import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { upsertGoogleConnectedAccount } from "@/lib/integrations/connected-accounts";
import {
  encryptGoogleTokens,
  exchangeGoogleAuthorizationCode,
  fetchGoogleUserInfo,
  parseGoogleScopes,
  tokenExpiresAt,
} from "@/lib/integrations/google-oauth";
import {
  COOKIE_RETURN,
  COOKIE_STATE,
  verifyGoogleOAuthState,
} from "@/lib/integrations/google-oauth-state";
import { recordOperationalError } from "@/lib/monitoring/operational-events";
import { notifyGoogleAccountConnected } from "@/lib/notifications/google-events";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const oauthError = requestUrl.searchParams.get("error");

  const cookieStore = await cookies();
  const returnTo = cookieStore.get(COOKIE_RETURN)?.value ?? "/founder/settings";
  const storedState = cookieStore.get(COOKIE_STATE)?.value;
  const redirectBase = new URL(returnTo, requestUrl.origin);

  cookieStore.delete(COOKIE_STATE);
  cookieStore.delete(COOKIE_RETURN);

  if (oauthError) {
    recordOperationalError("google.oauth_callback_error", new Error(oauthError), { returnTo });
    redirectBase.searchParams.set("google", "error");
    redirectBase.searchParams.set("message", oauthError);
    return NextResponse.redirect(redirectBase);
  }

  if (!code || !state) {
    redirectBase.searchParams.set("google", "error");
    redirectBase.searchParams.set("message", "missing_code");
    return NextResponse.redirect(redirectBase);
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/sign-in", requestUrl.origin));
  }

  if (!storedState || storedState !== state || !verifyGoogleOAuthState(state, user.id)) {
    redirectBase.searchParams.set("google", "error");
    redirectBase.searchParams.set("message", "invalid_state");
    return NextResponse.redirect(redirectBase);
  }

  try {
    const tokenResponse = await exchangeGoogleAuthorizationCode(code);

    if (!tokenResponse.refresh_token) {
      redirectBase.searchParams.set("google", "error");
      redirectBase.searchParams.set("message", "missing_refresh_token");
      return NextResponse.redirect(redirectBase);
    }

    const googleUser = await fetchGoogleUserInfo(tokenResponse.access_token);
    const encrypted = encryptGoogleTokens({
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
    });

    const result = await upsertGoogleConnectedAccount({
      userId: user.id,
      providerUserId: googleUser.id,
      email: googleUser.email,
      accessTokenEncrypted: encrypted.access_token_encrypted,
      refreshTokenEncrypted: encrypted.refresh_token_encrypted,
      tokenExpiresAt: tokenExpiresAt(tokenResponse.expires_in),
      scopes: parseGoogleScopes(tokenResponse.scope),
    });

    if (result.error) {
      recordOperationalError("google.account_save_failed", result.error, { userId: user.id });
      redirectBase.searchParams.set("google", "error");
      redirectBase.searchParams.set("message", "save_failed");
      return NextResponse.redirect(redirectBase);
    }

    void notifyGoogleAccountConnected({ userId: user.id, email: googleUser.email });

    redirectBase.searchParams.set("google", "connected");
    return NextResponse.redirect(redirectBase);
  } catch (error) {
    recordOperationalError("google.oauth_callback_failed", error, { userId: user.id });
    redirectBase.searchParams.set("google", "error");
    redirectBase.searchParams.set(
      "message",
      error instanceof Error ? error.message : "oauth_failed",
    );
    return NextResponse.redirect(redirectBase);
  }
}
