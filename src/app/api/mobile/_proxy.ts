// Runs one of the website's own API handlers as the signed in founder, from the phone's Bearer token.
// The website handlers read the person from createServerSupabaseClient(), which withBearerFounder
// points at the phone's session, so they behave exactly as they do on the website. New file, nothing existing is changed.
import "server-only";
import { NextResponse } from "next/server";
import { withBearerFounder } from "./_bearer";

export async function asFounder(req: Request, run: () => Promise<Response>): Promise<Response> {
  const r = await withBearerFounder(req, run);
  if (!r.ok) return NextResponse.json({ error: "unauthorized" }, { status: r.status });
  return r.value;
}

/** A copy of the request with a different JSON body, for handlers that read request.json(). */
export function withJson(req: Request, body: unknown): Request {
  const headers = new Headers(req.headers);
  headers.set("content-type", "application/json");
  return new Request(req.url, { method: req.method, headers, body: JSON.stringify(body) });
}
