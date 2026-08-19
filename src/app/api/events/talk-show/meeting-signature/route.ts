import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mints a Zoom Meeting SDK signature (JWT) so the Talk Show can embed a live Zoom
 * meeting IN the page (Component View — no Zoom app, no join link). The Client
 * Secret never leaves the server. Returns 503 "not_configured" until the Meeting
 * SDK app credentials are set — the client then falls back to the Join Zoom link.
 *
 * Since 2023 Zoom deprecated the old Meeting SDK app type: a General app's
 * Client ID + Client Secret are used, and the JWT must carry appKey/sdkKey =
 * Client ID. Payload (HS256): appKey, sdkKey, mn, role, iat, exp, tokenExp.
 * See https://developers.zoom.us/docs/meeting-sdk/auth/.
 *
 * Which meeting is joined comes from the session's admin-set Zoom link (the
 * "Go live with a link" URL, stored as sessions.video_ref) — parsed server-side
 * by sessionId so a viewer can only join the meeting an admin actually
 * configured. If the session has no Zoom link, we fall back to the env meeting
 * number. Everyone joins as a participant (role 0); the host runs the show and
 * controls everything from their own Zoom client.
 */

function b64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

/** Extract a Zoom meeting number + passcode from a join URL (…/j/<number>?pwd=…). */
function parseZoomJoinUrl(raw: string | null | undefined): { meetingNumber: string; passcode: string } | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!/(^|\.)zoom\.us$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/\/(?:j|wc|s)\/(\d{9,})/) ?? u.pathname.match(/\/(\d{9,})/);
    const meetingNumber = (m ? m[1] : u.searchParams.get("confno") ?? "").replace(/\D/g, "");
    if (!/^\d{9,}$/.test(meetingNumber)) return null;
    return { meetingNumber, passcode: u.searchParams.get("pwd") ?? "" };
  } catch {
    return null;
  }
}

function signMeetingSdkJwt(payload: Record<string, unknown>, secret: string): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const signature = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

export async function POST(req: Request): Promise<Response> {
  // Client ID (public — appears in the browser as the SDK key). The secret is the
  // one irreducible thing: without it we can't sign a JWT, so the stage stays in
  // fallback (Join Zoom) mode.
  const clientId = process.env.ZOOM_MEETING_SDK_CLIENT_ID ?? "tfzOcc6rTp2JdPGTTu2Rg";
  const clientSecret = process.env.ZOOM_MEETING_SDK_CLIENT_SECRET;
  if (!clientSecret) {
    return NextResponse.json(
      { error: "Zoom Meeting SDK is not configured yet.", code: "not_configured" },
      { status: 503 },
    );
  }

  // Meeting number + passcode: prefer the session's admin-set Zoom link (looked
  // up server-side by id so the client can't forge a target); fall back to env.
  let meetingNumber = (process.env.ZOOM_TALKSHOW_MEETING_NUMBER ?? "2613180099").replace(/\D/g, "");
  let passcode = process.env.ZOOM_TALKSHOW_MEETING_PASSCODE ?? "";
  const body = (await req.json().catch(() => null)) as { sessionId?: unknown } | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
  if (sessionId) {
    try {
      const db = createServiceRoleClient();
      const { data } = await db.from("sessions").select("video_ref").eq("id", sessionId).maybeSingle();
      const parsed = parseZoomJoinUrl((data as { video_ref?: string | null } | null)?.video_ref ?? null);
      if (parsed) {
        meetingNumber = parsed.meetingNumber;
        if (!passcode && parsed.passcode) passcode = parsed.passcode;
      }
    } catch {
      /* fall back to env meeting number */
    }
  }

  if (!meetingNumber) {
    return NextResponse.json(
      { error: "No Zoom meeting is configured for this session.", code: "not_configured" },
      { status: 503 },
    );
  }

  // Viewers join anonymously (as "Guest") unless signed in — the Talk Show is a
  // public stage, so we don't gate the embed behind login.
  const profile = await getCurrentUserProfile().catch(() => null);

  // Everyone in the embed joins as a participant (role 0). Joining as host
  // (role 1) requires being the actual meeting host and would error otherwise;
  // the host runs the show from their own Zoom client.
  const role = 0;
  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 2 * 60 * 60; // 2 hours

  const signature = signMeetingSdkJwt(
    {
      appKey: clientId,
      sdkKey: clientId,
      mn: Number(meetingNumber),
      role,
      iat,
      exp,
      tokenExp: exp,
    },
    clientSecret,
  );

  return NextResponse.json({
    signature,
    sdkKey: clientId,
    meetingNumber,
    password: passcode,
    userName: profile?.full_name ?? profile?.email ?? "Guest",
  });
}
