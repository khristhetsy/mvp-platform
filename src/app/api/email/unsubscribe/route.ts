import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/signed-links/tokens";
import { appBase } from "@/lib/notifications/founder-email-budget/digest";

export const dynamic = "force-dynamic";

/**
 * One click unsubscribe from founder digests (RFC 8058). Gmail and Yahoo POST
 * here from the List-Unsubscribe header; the link in the email body GETs here.
 * Either way the founder moves to instant alerts only: investor replies,
 * accepted intros and booked meetings still arrive. Possession of the signed
 * link is the authorization.
 */
async function apply(token: string | null): Promise<boolean> {
  if (!token) return false;
  const userId = verifyToken({ token, kind: "email_prefs", action: "instant_only" });
  if (!userId) return false;
  try {
    const client = createServiceRoleClient() as unknown as SupabaseClient;
    const now = new Date().toISOString();
    const { error } = await client
      .from("founder_email_prefs")
      .upsert({ user_id: userId, mode: "instant", unsubscribed_at: now, downshifted_at: null, downshift_from: null, updated_at: now }, { onConflict: "user_id" });
    if (error) return false;
    await client
      .from("founder_digest_items")
      .update({ status: "dropped", resolved_at: now, reason: "Founder unsubscribed from digests" })
      .eq("user_id", userId)
      .eq("status", "pending");
    return true;
  } catch {
    return false;
  }
}

function page(ok: boolean): Response {
  const settings = `${appBase()}/founder/settings/email`;
  const body = ok
    ? `<h1>You will only get instant alerts now</h1><p>No more daily or weekly summaries. Investor replies, accepted intros and booked meetings still reach you right away.</p><p><a href="${settings}">Change this in email settings</a></p>`
    : `<h1>This link has expired</h1><p>You can change how often we email you in <a href="${settings}">email settings</a>.</p>`;
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email preferences · iCapOS</title><style>body{font-family:Inter,-apple-system,system-ui,sans-serif;background:#F4F6FA;color:#0A1A40;margin:0;padding:48px 16px}main{max-width:520px;margin:0 auto;background:#fff;border:1px solid #DCE2EC;border-radius:12px;padding:28px}h1{font-size:22px;margin:0 0 12px}p{font-size:15px;line-height:1.6;color:#33415C}a{color:#1A6CE4}</style></head><body><main>${body}</main></body></html>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t");
  return page(await apply(token));
}

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("t");
  const ok = await apply(token);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
