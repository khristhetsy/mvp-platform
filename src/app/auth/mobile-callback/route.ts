// GET /auth/mobile-callback?token_hash=...&next=/founder/...
// Exchanges the one time token from /api/mobile/handoff for a normal website
// cookie session, then sends the founder to `next`.
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { searchParams } = url;
  // Redirect back to the address the phone used, not an internal host, so the cookie lands on the right site.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const origin = host ? `${proto}://${host}` : url.origin;
  const tokenHash = searchParams.get("token_hash");
  const next = searchParams.get("next") ?? "/founder";
  const allowed = ["/founder", "/upgrade", "/credits", "/billing", "/notifications"].some(
    (pre) => next === pre || next.startsWith(`${pre}/`) || next.startsWith(`${pre}?`),
  );
  const safeNext = allowed && !next.startsWith("//") && !next.includes("\\") ? next : "/founder";
  if (!tokenHash) return NextResponse.redirect(`${origin}/auth/sign-in`);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (error) return NextResponse.redirect(`${origin}/auth/sign-in`);
  return NextResponse.redirect(`${origin}${safeNext}`);
}
