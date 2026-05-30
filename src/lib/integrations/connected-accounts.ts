import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/integrations/token-encryption";
import type { Database } from "@/lib/supabase/types";

export type GoogleConnectionStatus = {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  scopes: string[];
  configured: boolean;
};

const PUBLIC_ACCOUNT_FIELDS =
  "id, user_id, provider, provider_user_id, email, scopes, connected_at, updated_at, token_expires_at" as const;

export async function getGoogleConnectionStatus(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<GoogleConnectionStatus> {
  const { getGoogleOAuthEnv } = await import("@/lib/integrations/google-env");
  const configured = getGoogleOAuthEnv() !== null;

  const { data } = await supabase
    .from("connected_accounts")
    .select(PUBLIC_ACCOUNT_FIELDS)
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  if (!data) {
    return { connected: false, email: null, connectedAt: null, scopes: [], configured };
  }

  return {
    connected: true,
    email: data.email,
    connectedAt: data.connected_at,
    scopes: data.scopes ?? [],
    configured,
  };
}

export async function upsertGoogleConnectedAccount(input: {
  userId: string;
  providerUserId: string;
  email: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  tokenExpiresAt: string | null;
  scopes: string[];
}) {
  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("connected_accounts")
    .upsert(
      {
        user_id: input.userId,
        provider: "google",
        provider_user_id: input.providerUserId,
        email: input.email,
        access_token_encrypted: input.accessTokenEncrypted,
        refresh_token_encrypted: input.refreshTokenEncrypted,
        token_expires_at: input.tokenExpiresAt,
        scopes: input.scopes,
        connected_at: now,
        updated_at: now,
        last_refresh_at: now,
      },
      { onConflict: "user_id,provider" },
    )
    .select(PUBLIC_ACCOUNT_FIELDS)
    .single();

  if (error) {
    return { error };
  }

  return { data };
}

export async function deleteGoogleConnectedAccount(userId: string) {
  const supabase = createServiceRoleClient();

  const { data: existing } = await supabase
    .from("connected_accounts")
    .select("refresh_token_encrypted, access_token_encrypted")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  if (existing?.refresh_token_encrypted) {
    try {
      const { revokeGoogleToken } = await import("@/lib/integrations/google-oauth");
      await revokeGoogleToken(decryptSecret(existing.refresh_token_encrypted));
    } catch {
      // Best-effort revoke; still remove local record.
    }
  }

  const { error } = await supabase
    .from("connected_accounts")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "google");

  if (error) {
    return { error };
  }

  return { data: true };
}

/** Server-only: loads encrypted tokens for Calendar API (never expose to client). */
export async function getGoogleConnectedAccountForUser(userId: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  if (error || !data) {
    return { error: error ?? new Error("Google account not connected.") };
  }

  return { data };
}
