// Runs one of the website's own API handlers as the signed in founder, from the phone's Bearer token.
// The website handlers read the person from createServerSupabaseClient(), which withBearerFounder
// points at the phone's session, so they behave exactly as they do on the website. New file, nothing existing is changed.
import "server-only";
import { NextResponse } from "next/server";
import { withBearerFounder, withBearerRole } from "./_bearer";

/** A request that runs longer than this answers 504 instead of holding the function open. */
export const MOBILE_TIMEOUT_MS = 25_000;

function withTimeout(run: () => Promise<Response>, ms = MOBILE_TIMEOUT_MS): () => Promise<Response> {
  return () =>
    new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => resolve(NextResponse.json({ error: "timeout" }, { status: 504 })), ms);
      run().then(
        (r) => {
          clearTimeout(timer);
          resolve(r);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
}

export async function asFounder(req: Request, run: () => Promise<Response>): Promise<Response> {
  const r = await withBearerFounder(req, withTimeout(run));
  if (!r.ok) return NextResponse.json({ error: "unauthorized" }, { status: r.status });
  return r.value;
}

/** Same, for routes both app sides use (reminders, notifications): a founder token runs as founder, an investor token as investor. */
export async function asMember(req: Request, run: () => Promise<Response>): Promise<Response> {
  const r = await withBearerRole(req, ["founder", "investor"], withTimeout(run));
  if (!r.ok) return NextResponse.json({ error: "unauthorized" }, { status: r.status });
  return r.value;
}

/** A copy of the request with a different JSON body, for handlers that read request.json(). */
export function withJson(req: Request, body: unknown): Request {
  const headers = new Headers(req.headers);
  headers.set("content-type", "application/json");
  return new Request(req.url, { method: req.method, headers, body: JSON.stringify(body) });
}
