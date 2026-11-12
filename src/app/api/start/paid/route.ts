import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkFormRateLimit } from "@/lib/ai-site/ratelimit";
import { claimPaidSignup } from "@/lib/billing/paid-signup";
import { PAID_SIGNUP_COOKIE, verifyPaidSignupToken } from "@/lib/billing/paid-signup-core";
import { createCookieSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().max(120).optional(),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});

/** Creates the login for someone who already paid, applies their plan, and signs them in. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const limited = await checkFormRateLimit({ scope: "paid_signup_claim", ip, limit: 15 });
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please enter a password." }, { status: 400 });
  }
  const signupId = verifyPaidSignupToken(parsed.data.token ?? req.cookies.get(PAID_SIGNUP_COOKIE)?.value);
  if (!signupId) {
    return NextResponse.json({ error: "This link is not valid. Please use the link in your payment email." }, { status: 401 });
  }

  const result = await claimPaidSignup({ signupId, password: parsed.data.password });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }

  let signedIn = false;
  try {
    const supabase = await createCookieSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email: result.email, password: parsed.data.password });
    signedIn = !error;
  } catch {
    signedIn = false;
  }
  const res = NextResponse.json({ ok: true, signedIn, redirect: signedIn ? "/founder/onboarding" : "/auth/sign-in" });
  res.cookies.delete(PAID_SIGNUP_COOKIE);
  return res;
}
