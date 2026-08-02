/**
 * AI proxy rate limiting (spec §7.2). Non-negotiable — without it the analyzer is
 * an open invoice. Limits:
 *   - per IP:      20 / hour, 60 / day
 *   - per session: 40 / session
 *   - global:      env-configurable daily call ceiling → friendly "AI is resting"
 *
 * PRODUCTION NOTE: the default store here is in-memory, which is correct for dev
 * and unit tests but does NOT share state across edge invocations. Before launch,
 * back `hit()` with Upstash Redis / Vercel KV (INCR + EXPIRE) — the interface is
 * isolated to `hit()` so only that function changes.
 */

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

function hit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const b = store.get(key);
  if (!b || b.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }
  b.count += 1;
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count), resetAt: b.resetAt };
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type RateResult = { ok: true } | { ok: false; retryAfterSec: number; reason: "rate" | "resting" };

/** Env-configurable global daily ceiling; 0/unset disables the circuit breaker. */
function dailyCeiling(): number {
  const raw = Number(process.env.AI_DAILY_CALL_CEILING ?? "0");
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export function checkRateLimit(input: { ip: string; sessionId?: string | null }): RateResult {
  const dayKey = new Date().toISOString().slice(0, 10);

  // Global circuit breaker first — cheapest way to stop a spend runaway.
  const ceiling = dailyCeiling();
  if (ceiling > 0) {
    const g = hit(`ai:global:${dayKey}`, ceiling, DAY);
    if (!g.ok) return { ok: false, retryAfterSec: Math.ceil((g.resetAt - Date.now()) / 1000), reason: "resting" };
  }

  const perHour = hit(`ai:ip:h:${input.ip}:${dayKey}:${new Date().getUTCHours()}`, 20, HOUR);
  if (!perHour.ok) return { ok: false, retryAfterSec: Math.ceil((perHour.resetAt - Date.now()) / 1000), reason: "rate" };

  const perDay = hit(`ai:ip:d:${input.ip}:${dayKey}`, 60, DAY);
  if (!perDay.ok) return { ok: false, retryAfterSec: Math.ceil((perDay.resetAt - Date.now()) / 1000), reason: "rate" };

  if (input.sessionId) {
    const perSession = hit(`ai:sess:${input.sessionId}`, 40, DAY);
    if (!perSession.ok) return { ok: false, retryAfterSec: Math.ceil((perSession.resetAt - Date.now()) / 1000), reason: "rate" };
  }

  return { ok: true };
}

/** Test/maintenance helper — clears all counters. */
export function __resetRateLimit(): void {
  store.clear();
}
