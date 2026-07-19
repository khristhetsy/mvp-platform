import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function secret(): string {
  return (
    process.env.UNSUBSCRIBE_SECRET ??
    process.env.TOKEN_ENCRYPTION_SECRET ??
    process.env.CRON_SECRET ??
    "icapos-outreach-unsub"
  );
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Stateless HMAC token for an email — no per-recipient storage, not enumerable. */
export function unsubscribeToken(email: string): string {
  return crypto.createHmac("sha256", secret()).update(normalizeEmail(email)).digest("hex").slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = unsubscribeToken(email);
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function buildUnsubscribeUrl(email: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/$/, "");
  const params = new URLSearchParams({ e: normalizeEmail(email), t: unsubscribeToken(email) });
  return `${base}/unsubscribe?${params.toString()}`;
}

function client(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export async function addUnsubscribe(email: string): Promise<void> {
  await client()
    .from("outreach_unsubscribes")
    .upsert({ email: normalizeEmail(email) }, { onConflict: "email", ignoreDuplicates: true });
}

/** Returns the set of suppressed emails from the given list (normalized). */
export async function filterUnsubscribed(emails: string[]): Promise<Set<string>> {
  const normalized = emails.map(normalizeEmail).filter(Boolean);
  if (normalized.length === 0) return new Set();
  const { data } = await client().from("outreach_unsubscribes").select("email").in("email", normalized);
  return new Set((data ?? []).map((row: { email: string }) => row.email));
}
