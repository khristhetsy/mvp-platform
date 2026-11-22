/**
 * Resend answers 429 for two different reasons. A rate limit (too many requests per
 * second) clears quickly, so a short wait and retry works. A plan quota (monthly or
 * daily sending limit) does not, so retrying only adds delay. The error name tells
 * them apart: "rate_limit_exceeded" versus "monthly_quota_exceeded" or
 * "daily_quota_exceeded". Reads a clone, so the caller can still read the body.
 */
export async function isQuotaExceeded(res: Response): Promise<boolean> {
  const body = await res.clone().text().catch(() => "");
  return /quota_exceeded/i.test(body);
}
