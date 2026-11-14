import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkFormRateLimit } from "@/lib/ai-site/ratelimit";
import { findResendableSignupId, resendLoginLink } from "@/lib/billing/paid-signup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().trim().email().max(254) });

/**
 * The "Paid but have no login yet?" form on the sign in page. The answer is
 * the same whether or not the email paid, so it never reveals who is a customer.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const limited = await checkFormRateLimit({ scope: "paid_signup_resend", ip, limit: 6 });
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });

  try {
    const id = await findResendableSignupId(parsed.data.email);
    if (id) await resendLoginLink(id);
  } catch (err) {
    console.error("[paid-signup] public resend failed", err);
  }
  return NextResponse.json({ ok: true });
}
