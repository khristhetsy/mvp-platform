/**
 * Make failed queries visible.
 *
 * The dominant pattern in this codebase is:
 *
 *     const { data } = await db().from("x").select(...);
 *     const rows = (data ?? []) as Row[];
 *
 * which discards `error` entirely. A query that fails — a renamed column, a constraint,
 * a permissions change — is then indistinguishable from a query that legitimately matched
 * nothing. That is not hypothetical: the social funnel filtered crm_contacts on a
 * `created_at` column that does not exist, and reported zero conversions for every
 * campaign for months without a single error anywhere.
 *
 * PostgREST error codes worth knowing when one of these shows up in Sentry:
 *   42703 undefined column · 42P01 undefined table · 23505 unique violation
 *   23514 check violation  · PGRST116 no rows for .single()
 */
import * as Sentry from "@sentry/nextjs";

// The shape supabase-js returns; kept loose so callers can pass it straight through.
export type DbError = { message?: string; code?: string; details?: string; hint?: string } | null | undefined;

/**
 * Report a query error and return whether there was one, so it composes inline:
 *
 *     const { data, error } = await db().from("t").select("*");
 *     if (reportDbError("myFn: load t", error)) return [];
 *
 * Never throws — reporting a problem must not create a worse one.
 */
export function reportDbError(context: string, error: DbError): boolean {
  if (!error) return false;
  const code = error.code ?? "unknown";
  const message = error.message ?? String(error);
  try {
    Sentry.captureMessage(`DB query failed [${code}] ${context}: ${message}`, {
      level: "error",
      tags: { db_error_code: code, db_context: context },
      extra: { details: error.details, hint: error.hint },
    });
  } catch {
    // Sentry unavailable (local, or not initialised) — fall through to the console.
  }
  // Always log too: Sentry is not configured in local dev, which is exactly where a
  // developer would most benefit from seeing this immediately.
  console.error(`[db] ${context} failed [${code}]: ${message}`, error.details ?? "");
  return true;
}
