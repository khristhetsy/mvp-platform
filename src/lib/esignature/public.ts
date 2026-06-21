// Server-only helpers for the token-gated signer flow. Always use the
// service-role client; the anonymous signer never queries Supabase directly.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { SignatureRequest, SignatureField } from "./types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

/** Look up an envelope by its access token. */
export async function getRequestByToken(
  supabase: SupabaseClient<Database>,
  token: string,
): Promise<SignatureRequest | null> {
  if (!token || token.length < 16) return null;
  const { data } = await raw(supabase)
    .from("signature_requests")
    .select("*")
    .eq("access_token", token)
    .maybeSingle();
  return (data as unknown as SignatureRequest) ?? null;
}

/** First open: flip sent → viewed and stamp viewed_at. Idempotent. */
export async function markViewed(supabase: SupabaseClient<Database>, id: string): Promise<void> {
  await raw(supabase)
    .from("signature_requests")
    .update({ status: "viewed", viewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "sent");
}

/** Record ESIGN/UETA consent. */
export async function recordConsent(supabase: SupabaseClient<Database>, id: string): Promise<void> {
  await raw(supabase).from("signature_requests").update({ consent_accepted: true }).eq("id", id);
}

/** Persist captured field values + flip to signed. Returns nothing. */
export async function saveSignerValuesAndSign(
  supabase: SupabaseClient<Database>,
  id: string,
  values: { fieldId: string; value: string }[],
): Promise<void> {
  // Update each field's value individually (small N — one signer, few fields).
  for (const v of values) {
    await raw(supabase).from("signature_fields").update({ value: v.value }).eq("id", v.fieldId);
  }
  await raw(supabase)
    .from("signature_requests")
    .update({ status: "signed", signed_at: new Date().toISOString() })
    .eq("id", id);
}

/** Creator (admin) email for completion notices. */
export async function getCreatorEmail(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data } = await raw(supabase).from("profiles").select("email").eq("id", userId).maybeSingle();
  return (data as { email?: string } | null)?.email ?? null;
}

export async function listFieldsForToken(
  supabase: SupabaseClient<Database>,
  requestId: string,
): Promise<SignatureField[]> {
  const { data } = await raw(supabase)
    .from("signature_fields")
    .select("*")
    .eq("request_id", requestId)
    .order("page", { ascending: true });
  return (data as unknown as SignatureField[]) ?? [];
}
