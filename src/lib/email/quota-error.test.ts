import { describe, it, expect } from "vitest";
import { isQuotaExceeded } from "./quota-error";

const res = (body: string) => new Response(body, { status: 429 });

describe("isQuotaExceeded", () => {
  it("is true for the monthly quota error", async () => {
    expect(await isQuotaExceeded(res('{"name":"monthly_quota_exceeded","statusCode":429}'))).toBe(true);
  });
  it("is true for the daily quota error", async () => {
    expect(await isQuotaExceeded(res('{"name":"daily_quota_exceeded","statusCode":429}'))).toBe(true);
  });
  it("is false for a plain rate limit, which should still retry", async () => {
    expect(await isQuotaExceeded(res('{"name":"rate_limit_exceeded","statusCode":429}'))).toBe(false);
  });
  it("leaves the body readable for the caller", async () => {
    const r = res('{"name":"monthly_quota_exceeded"}');
    await isQuotaExceeded(r);
    expect(await r.text()).toContain("monthly_quota_exceeded");
  });
});
