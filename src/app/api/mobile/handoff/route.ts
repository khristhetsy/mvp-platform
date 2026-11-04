// POST /api/mobile/handoff  { path: "/founder/..." or "/investor/..." }  (Authorization: Bearer ...)
// Returns a one time URL. Opening it in the app's in-app frame signs the
// website in as the same person (cookie session) and lands on `path`, so they
// do not log in a second time. The link is single use and expires
// quickly (Supabase one time token). Nothing is emailed.
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { withBearerFounder } from "../_bearer";
import { withBearerInvestor } from "../_bearer-investor";

export const dynamic = "force-dynamic";

// Pages a founder opens from the app: the founder workspace, plus the account pages in the avatar menu.
const FOUNDER_PREFIXES = ["/founder", "/upgrade", "/credits", "/billing", "/notifications"];
// Pages an investor opens from the app: the investor workspace and notifications.
const INVESTOR_PREFIXES = ["/investor", "/notifications"];
function safePath(p: unknown, prefixes: string[]): string | null {
  if (typeof p !== "string" || p.startsWith("//") || p.includes("\\")) return null;
  const ok = prefixes.some((pre) => p === pre || p.startsWith(`${pre}/`) || p.startsWith(`${pre}?`));
  return ok ? p : null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { path?: unknown };
  const founderPath = safePath(body.path, FOUNDER_PREFIXES);
  const investorPath = safePath(body.path, INVESTOR_PREFIXES);
  const path = founderPath ?? investorPath;
  if (!path) return NextResponse.json({ error: "bad path" }, { status: 400 });

  const makeLink = async ({ email }: { email: string }) => {
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
  };

  // A founder token only opens founder pages and an investor token only opens investor pages.
  let result: { ok: true; value: { url: string } | null } | { ok: false; status: number } = founderPath
    ? await withBearerFounder(req, makeLink)
    : { ok: false, status: 403 };
  if (!result.ok && result.status === 403 && investorPath) result = await withBearerInvestor(req, makeLink);
  if (!result.ok) return NextResponse.json({ error: "unauthorized" }, { status: result.status });
  if (!result.value) return NextResponse.json({ error: "link failed" }, { status: 500 });
  return NextResponse.json(result.value, { headers: { "Cache-Control": "no-store" } });
}
