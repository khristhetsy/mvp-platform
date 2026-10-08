/**
 * Who a scheduled send runs as.
 *
 * When a scheduled email's time comes, the cron replays the stored request
 * through the same send route the button uses. Those routes read the signed in
 * person from createServerSupabaseClient(), which normally reads the session
 * cookie. During a replay there is no cookie, so the runner signs in as the
 * person who scheduled the send (a one time server side session, signed out
 * again right after) and puts that client here; createServerSupabaseClient()
 * returns it for the duration of the replay. Only the scheduled email runner
 * sets this; nothing a browser sends can.
 *
 * Server only: imported by supabase/server.ts and email/email-log.ts.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export type ActingUser = { userId: string; client: unknown };

const store = new AsyncLocalStorage<ActingUser>();

export function runAsActingUser<T>(acting: ActingUser, fn: () => Promise<T>): Promise<T> {
  return store.run(acting, fn);
}

/** The scheduled send's signed in client, or null outside a scheduled send. */
export function actingUserClient(): unknown | null {
  return store.getStore()?.client ?? null;
}

/** The person a scheduled send runs as, or null outside a scheduled send. */
export function actingUserId(): string | null {
  return store.getStore()?.userId ?? null;
}
