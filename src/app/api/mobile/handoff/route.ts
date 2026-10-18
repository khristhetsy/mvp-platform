// POST /api/mobile/handoff  { path: "/founder/..." }  (Authorization: Bearer ...)
// Returns a one time URL. Opening it in the app's in-app frame signs the
// website in as the same founder (cookie session) and lands on `path`, so the
// founder does not log in a second time. The link is single use and expires
// quickly (Supabase one time token). Nothing is emailed.
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { withBearerFounder } from "../_bearer";

export const dynamic = "force-dynamic";

// Pages a founder opens from the app: the founder workspace, plus the account pages in the avatar menu.
const ALLOWED_PREFIXES = ["/founder", "/upgrade", "/credits", "/billing", "/notifications"];
function safePath(p: unknown): string | null {
  if (typeof p !== "string" || p.startsWith("//") || p.includes("\\")) return null;
  const ok = ALLOWED_PREFIXES.some((pre) => p === pre || p.startsWith(`${pre}/`) || p.startsWith(`${pre}?`));
  return ok ? p : null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { path?: unknown };
  const path = safePath(body.path);
  if (!path) return NextResponse.json({ error: "bad path" }, { status: 400 });

  const result = await withBearerFounder(req, async ({ email }) => {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const hashed = data?.properties?.hashed_token;
    if (error || !hashed) return null;
    // The phone opens this link, so use the address the phone called (not an internal host) when the proxy tells us.
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
    const origin = host ? `${proto}://${host}` : new URL(req.url).origin;
    const url = `${origin}/auth/mobile-callback?token_hash=${encodeURIComponent(hashed)}&next=${encodeURIComponent(path)}`;
    return { url };
  });
  if (!result.ok) return NextResponse.json({ error: "unauthorized" }, { status: result.status });
  if (!result.value) return NextResponse.json({ error: "link failed" }, { status: 500 });
  return NextResponse.json(result.value, { headers: { "Cache-Control": "no-store" } });
}
