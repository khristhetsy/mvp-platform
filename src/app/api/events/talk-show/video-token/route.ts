import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { getCurrentUserProfile } from "@/lib/supabase/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mints a short-lived Zoom Video SDK session token so the Talk Show can render
 * live video IN the page (no Zoom app, no join link). The SDK Secret never
 * leaves the server. Returns 503 "not_configured" until the Video SDK app
 * credentials are set — the client falls back to the Join Zoom link in that case.
 *
 * Video SDK JWT payload (HS256): app_key, tpc (session/topic), role_type
 * (1 = host, 0 = participant), user_identity, version, iat, exp.
 */

function b64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function signVideoSdkJwt(payload: Record<string, unknown>, secret: string): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const signature = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

/** Session-name safety: Zoom rejects some characters; keep it simple + bounded. */
function safeTopic(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, 200);
  return /^[A-Za-z0-9 _.\-:]+$/.test(trimmed) ? trimmed : null;
}

export async function POST(req: Request): Promise<Response> {
  const key = process.env.ZOOM_VIDEO_SDK_KEY;
  const secret = process.env.ZOOM_VIDEO_SDK_SECRET;
  if (!key || !secret) {
    return NextResponse.json(
      { error: "Zoom Video SDK is not configured yet.", code: "not_configured" },
      { status: 503 },
    );
  }

  const profile = await getCurrentUserProfile().catch(() => null);
  if (!profile) {
    return NextResponse.json({ error: "Sign in to join the stage." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { sessionName?: unknown } | null;
  const topic = safeTopic(body?.sessionName);
  if (!topic) {
    return NextResponse.json({ error: "A valid sessionName is required." }, { status: 400 });
  }

  // Staff (admin/analyst) host the stage; everyone else joins as a participant.
  const role = String(profile.role ?? "").toLowerCase();
  const roleType = role === "admin" || role === "analyst" ? 1 : 0;

  const now = Math.floor(Date.now() / 1000);
  const token = signVideoSdkJwt(
    {
      app_key: key,
      tpc: topic,
      role_type: roleType,
      user_identity: profile.id,
      version: 1,
      iat: now,
      exp: now + 2 * 60 * 60, // 2 hours
    },
    secret,
  );

  return NextResponse.json({
    token,
    sessionName: topic,
    userName: profile.full_name ?? profile.email ?? "Guest",
    roleType,
    // The stage matches this against each onstage guest's profile_id to decide
    // whether the local user broadcasts and which remote tiles to render.
    userIdentity: profile.id,
  });
}
