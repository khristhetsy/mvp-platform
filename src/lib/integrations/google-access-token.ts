import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getGoogleConnectedAccountForUser } from "@/lib/integrations/connected-accounts";
import { isGoogleOAuthConfigured } from "@/lib/integrations/google-env";
import {
  encryptGoogleTokens,
  refreshGoogleAccessToken,
  tokenExpiresAt,
} from "@/lib/integrations/google-oauth";
import { decryptSecret } from "@/lib/integrations/token-encryption";

const EXPIRY_BUFFER_MS = 60_000;

export async function getValidGoogleAccessToken(userId: string) {
  if (!isGoogleOAuthConfigured()) {
    return { error: new Error("Google OAuth is not configured.") };
  }

  const accountResult = await getGoogleConnectedAccountForUser(userId);
  if (accountResult.error || !accountResult.data) {
    return { error: accountResult.error ?? new Error("Google account not connected.") };
  }

  const account = accountResult.data;
  const expiresAtMs = account.token_expires_at
    ? new Date(account.token_expires_at).getTime()
    : 0;

  if (expiresAtMs - EXPIRY_BUFFER_MS > Date.now()) {
    try {
      return { accessToken: decryptSecret(account.access_token_encrypted) };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error("Unable to decrypt access token.") };
    }
  }

  if (!account.refresh_token_encrypted) {
    return { error: new Error("Google refresh token is missing. Reconnect your Google account.") };
  }

  try {
    const refreshToken = decryptSecret(account.refresh_token_encrypted);
    const refreshed = await refreshGoogleAccessToken(refreshToken);
    const encrypted = encryptGoogleTokens({
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? refreshToken,
    });

    const supabase = createServiceRoleClient();
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("connected_accounts")
      .update({
        access_token_encrypted: encrypted.access_token_encrypted,
        refresh_token_encrypted: encrypted.refresh_token_encrypted,
        token_expires_at: tokenExpiresAt(refreshed.expires_in),
        last_refresh_at: now,
        updated_at: now,
      })
      .eq("id", account.id);

    if (updateError) {
      return { error: updateError };
    }

    return { accessToken: refreshed.access_token };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error("Unable to refresh Google access token.") };
  }
}
