/**
 * AI proxy rate limiting (spec §7.2). Non-negotiable — without it the analyzer is
 * an open invoice. Limits:
 *   - per IP:      20 / hour, 60 / day
 *   - per session: 40 / session
 *   - global:      env-configurable daily call ceiling → friendly "AI is resting"
 *
 * Two backends behind one shape (`HitResult`):
 *   - DURABLE (production): Upstash Redis REST (INCR + EXPIRE NX + PTTL in one
 *     pipeline). Edge-safe — plain fetch, no SDK. Enabled when both
 *     UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set. This is what
 *     actually holds across edge invocations.
 *   - IN-MEMORY (dev / unit tests / Redis outage): per-isolate Map. Used when
 *     Upstash isn't configured, and as a fail-safe if a Redis call throws.
 *
 * `checkRateLimit` stays synchronous (in-memory) for the unit tests; the route
 * calls the async `checkRateLimitAsync`, which uses Redis when configured.
 */

type HitResult = { ok: boolean; remaining: number; resetAt: number };

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

function hit(key: string, limit: number, windowMs: number): HitResult {
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

function upstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/** Durable INCR+EXPIRE(NX)+PTTL via Upstash REST pipeline; falls back to the
 *  in-memory bucket on any error so a Redis blip never fails the request open. */
async function hitDurable(key: string, limit: number, windowMs: number): Promise<HitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return hit(key, limit, windowMs);
  const windowSec = Math.ceil(windowMs / 1000);
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", key], ["EXPIRE", key, windowSec, "NX"], ["PTTL", key]]),
    });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    const data = (await res.json()) as Array<{ result?: unknown }>;
    const count = Number(data?.[0]?.result ?? 0);
    let ttl = Number(data?.[2]?.result ?? windowMs);
    if (!Number.isFinite(ttl) || ttl < 0) ttl = windowMs;
    if (!Number.isFinite(count) || count <= 0) throw new Error("upstash bad count");
    return { ok: count <= limit, remaining: Math.max(0, limit - count), resetAt: Date.now() + ttl };
  } catch {
    return hit(key, limit, windowMs);
  }
}

export type RateResult = { ok: true } | { ok: false; retryAfterSec: number; reason: "rate" | "resting" };

/** Env-configurable global daily ceiling; 0/unset disables the circuit breaker. */
function dailyCeiling(): number {
  const raw = Number(process.env.AI_DAILY_CALL_CEILING ?? "0");
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function rate(h: HitResult, reason: "rate" | "resting"): RateResult {
  return { ok: false, retryAfterSec: Math.ceil((h.resetAt - Date.now()) / 1000), reason };
}

/** Synchronous, in-memory only. Kept for the unit tests. */
export function checkRateLimit(input: { ip: string; sessionId?: string | null }): RateResult {
  const dayKey = new Date().toISOString().slice(0, 10);

  // Global circuit breaker first — cheapest way to stop a spend runaway.
  const ceiling = dailyCeiling();
  if (ceiling > 0) {
    const g = hit(`ai:global:${dayKey}`, ceiling, DAY);
    if (!g.ok) return rate(g, "resting");
  }

  const perHour = hit(`ai:ip:h:${input.ip}:${dayKey}:${new Date().getUTCHours()}`, 20, HOUR);
  if (!perHour.ok) return rate(perHour, "rate");

  const perDay = hit(`ai:ip:d:${input.ip}:${dayKey}`, 60, DAY);
  if (!perDay.ok) return rate(perDay, "rate");

  if (input.sessionId) {
    const perSession = hit(`ai:sess:${input.sessionId}`, 40, DAY);
    if (!perSession.ok) return rate(perSession, "rate");
  }

  return { ok: true };
}

/** Durable (Upstash when configured, else in-memory). Called by the route. Same
 *  limit sequence as checkRateLimit; global ceiling is checked first. */
export async function checkRateLimitAsync(input: { ip: string; sessionId?: string | null }): Promise<RateResult> {
  if (!upstashConfigured()) return checkRateLimit(input);
  const dayKey = new Date().toISOString().slice(0, 10);

  const ceiling = dailyCeiling();
  if (ceiling > 0) {
    const g = await hitDurable(`ai:global:${dayKey}`, ceiling, DAY);
    if (!g.ok) return rate(g, "resting");
  }

  const perHour = await hitDurable(`ai:ip:h:${input.ip}:${dayKey}:${new Date().getUTCHours()}`, 20, HOUR);
  if (!perHour.ok) return rate(perHour, "rate");

  const perDay = await hitDurable(`ai:ip:d:${input.ip}:${dayKey}`, 60, DAY);
  if (!perDay.ok) return rate(perDay, "rate");

  if (input.sessionId) {
    const perSession = await hitDurable(`ai:sess:${input.sessionId}`, 40, DAY);
    if (!perSession.ok) return rate(perSession, "rate");
  }

  return { ok: true };
}

/** Test/maintenance helper — clears all counters. */
export function __resetRateLimit(): void {
  store.clear();
}
