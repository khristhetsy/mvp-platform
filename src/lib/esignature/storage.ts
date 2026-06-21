// Storage + audit helpers for the e-signature feature. All access is via the
// service-role client (server-side only); the bucket is private.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { STORAGE_BUCKET, type AuditEventType } from "./types";

// signature_* tables aren't in the generated types yet — raw cast.
function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

/** Upload bytes to the private signature bucket. Returns the stored path. */
export async function uploadToSignatureBucket(
  supabase: SupabaseClient<Database>,
  path: string,
  bytes: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

/** Short-lived signed URL for a private object (default 10 minutes). */
export async function signatureSignedUrl(
  supabase: SupabaseClient<Database>,
  path: string,
  expiresInSeconds = 600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Append a row to the tamper-evidence audit chain. */
export async function writeSignatureAudit(
  supabase: SupabaseClient<Database>,
  input: {
    requestId: string;
    eventType: AuditEventType;
    actor?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  await raw(supabase)
    .from("signature_audit_events")
    .insert({
      request_id: input.requestId,
      event_type: input.eventType,
      actor: input.actor ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      metadata: input.metadata ?? null,
    });
}

/** Read the audit chain for an envelope (oldest first). */
export async function listAuditEvents(
  supabase: SupabaseClient<Database>,
  requestId: string,
): Promise<Array<{ id: string; event_type: string; actor: string | null; ip_address: string | null; created_at: string }>> {
  const { data } = await raw(supabase)
    .from("signature_audit_events")
    .select("id, event_type, actor, ip_address, created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  return (data as Array<{ id: string; event_type: string; actor: string | null; ip_address: string | null; created_at: string }>) ?? [];
}

/** Best-effort client IP + user agent from a request, for the audit trail. */
export function requestClientMeta(req: Request): { ip: string | null; userAgent: string | null } {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0]!.trim() : req.headers.get("x-real-ip");
  return { ip: ip || null, userAgent: req.headers.get("user-agent") };
}
