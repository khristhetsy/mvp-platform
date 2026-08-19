import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { getCurrentUserProfile } from "@/lib/supabase/auth";

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
 * The meeting number + passcode come from server env (not the client), so a
 * viewer can only ever join the configured Talk Show meeting. Everyone joins as
 * a participant (role 0); the host starts the meeting from their Zoom client.
 */

function b64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function signMeetingSdkJwt(payload: Record<string, unknown>, secret: string): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const signature = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

export async function POST(): Promise<Response> {
  // Client ID (public — appears in the browser as the SDK key) and the meeting
  // number default to the app's values, so the only thing that must be set in
  // the environment is the secret. Any of these can be overridden via env.
  const clientId = process.env.ZOOM_MEETING_SDK_CLIENT_ID ?? "tfzOcc6rTp2JdPGTTu2Rg";
  const clientSecret = process.env.ZOOM_MEETING_SDK_CLIENT_SECRET;
  const meetingNumber = (process.env.ZOOM_TALKSHOW_MEETING_NUMBER ?? "2613180099").replace(/\D/g, "");
  // The secret is the one irreducible thing: without it we can't sign a JWT, so
  // the stage stays in fallback (Join Zoom) mode.
  if (!clientSecret || !meetingNumber) {
    return NextResponse.json(
      { error: "Zoom Meeting SDK is not configured yet.", code: "not_configured" },
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
    password: process.env.ZOOM_TALKSHOW_MEETING_PASSCODE ?? "",
    userName: profile?.full_name ?? profile?.email ?? "Guest",
  });
}
