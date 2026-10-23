import { NextRequest, NextResponse } from "next/server";
import { verifyTestimonialToken } from "@/lib/testimonials/token";
import { validateTestimonial } from "@/lib/testimonials/validate";
import { loadTestimonialContext, saveTestimonial } from "@/lib/testimonials/db";
import { checkFormRateLimit } from "@/lib/ai-site/ratelimit";

/**
 * Public submit endpoint for icapos.com/testimonial. No login: the signed token
 * from the email identifies the founder. Saves as pending for admin review.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const limited = await checkFormRateLimit({ scope: "testimonial", ip, limit: 5 });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = validateTestimonial(body);
  if (!parsed.ok) return NextResponse.json({ errors: parsed.errors }, { status: 400 });

  const email = verifyTestimonialToken(parsed.value.token);
  if (!email) {
    return NextResponse.json({ errors: { token: "This link isn't valid. Use the button in your email." } }, { status: 403 });
  }

  try {
    const ctx = await loadTestimonialContext(email);
    await saveTestimonial(ctx, parsed.value);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[testimonial] save failed", err);
    return NextResponse.json({ error: "Couldn't save your recommendation. Try again in a minute." }, { status: 500 });
  }
}
