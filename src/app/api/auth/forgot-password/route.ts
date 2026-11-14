import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { checkFormRateLimit } from "@/lib/ai-site/ratelimit";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().trim().email().max(254) });

/**
 * Sends the standard password reset email. The answer is the same whether or
 * not the email has an account. The link opens the existing reset page.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const limited = await checkFormRateLimit({ scope: "forgot_password", ip, limit: 6 });
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });

  try {
    const { url, anonKey } = getSupabaseBrowserEnv();
    // The implicit flow puts the recovery token in the link, which the reset page reads.
    const supabase = createClient(url, anonKey, { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false } });
    const origin = new URL(req.url).origin;
    await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${origin}/auth/reset-password` });
  } catch (err) {
    console.error("[forgot-password] failed", err);
  }
  return NextResponse.json({ ok: true });
}
