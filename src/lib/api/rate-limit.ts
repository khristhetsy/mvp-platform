type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitEntry>();

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: number }
  | { allowed: false; remaining: 0; resetAt: number; retryAfterMs: number };

export function checkRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(input.key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + input.windowMs;
    buckets.set(input.key, { count: 1, resetAt });
    return { allowed: true, remaining: input.limit - 1, resetAt };
  }

  if (existing.count >= input.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterMs: Math.max(0, existing.resetAt - now),
    };
  }

  existing.count += 1;
  buckets.set(input.key, existing);
  return { allowed: true, remaining: input.limit - existing.count, resetAt: existing.resetAt };
}

export function rateLimitResponse(retryAfterMs: number) {
  return Response.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
      },
    },
  );
}

export async function enforceRateLimit(input: {
  bucket: string;
  subjectId: string;
  limit: number;
  windowMs: number;
}) {
  const result = checkRateLimit({
    key: `${input.bucket}:${input.subjectId}`,
    limit: input.limit,
    windowMs: input.windowMs,
  });

  if (!result.allowed) {
    return rateLimitResponse(result.retryAfterMs);
  }

  return null;
}
