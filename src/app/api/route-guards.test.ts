import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Every API route must check who is calling. Most routes use the service role
 * client, which bypasses RLS, so the route's own check is the only protection.
 * A new route without one fails here instead of reaching production.
 */

const API_DIR = join(process.cwd(), "src", "app", "api");

// Session or role guards: the require* helpers from src/lib/api, plus the feature specific ones.
// Matching is by name, so a route that calls one of these counts as guarded.
const GUARD = new RegExp(
  [
    String.raw`\brequire[A-Z][A-Za-z]*\s*\(`,
    String.raw`\b(?:staffOnly|irStaff|accountingGuard|directoryAdmin|guardMatchAdmin|sequenceSender)\s*\(`,
    String.raw`\b(?:withBearerFounder|withBearerInvestor|asMember|asFounder|getCurrentUserProfile)\s*\(`,
    String.raw`\b(?:startActOnBehalf|stopActOnBehalf|resolveFounderOwnCompany|actorAndBundle)\s*\(`,
    String.raw`\bgate[A-Za-z]*Api\s*\(`,
    String.raw`\bresolve[A-Za-z]*Requester\s*\(`,
    String.raw`\.auth\.getUser\s*\(`,
  ].join("|"),
);

// Routes that authenticate the caller another way: a cron or webhook secret, a signed
// webhook, or a signed single use link that carries the authorisation in the token.
const SELF_AUTH = new RegExp(
  [
    String.raw`\bverify[A-Za-z]*(?:Signature|Event|Token)\s*\(`,
    String.raw`\bconstructEvent\s*\(`,
    String.raw`\b(?:CRON_SECRET|RESEND_WEBHOOK_SECRET|OUTREACH_INBOUND_SECRET|VOICE_AGENT_SECRET)\b`,
    String.raw`\b(?:withCronGate|validateCronSecret|voiceWebhookAuthorized)\s*\(`,
    String.raw`\bsvix\b|\btimingSafeEqual\s*\(`,
    String.raw`\bintroFrom[A-Za-z]*Token\s*\(|\bregistrationFromNetworkingToken\s*\(`,
    String.raw`\b(?:getRequestByToken|loadSharedReport|packetDocument|reportClientPayment)\s*\(`,
  ].join("|"),
);

// Public on purpose, with no rate limit of its own yet. Listed so a new open route cannot
// slip in unnoticed. Add a route here only with a reason, and prefer adding a rate limit.
const OPEN_ROUTES: Record<string, string> = {
  "fit/capture/route.ts": "public fit tool, session cookie, no rate limit yet",
  "fit/match/route.ts": "public fit tool, no rate limit yet",
  "fit/session/route.ts": "public fit tool, no rate limit yet",
  "fit/sectors/route.ts": "public sector list, read only",
  "scheduling/slots/route.ts": "public booking page, read only",
  "ir-agent/[agentId]/reply/route.ts": "public AI reply, rate limit and budget live inside agentReply",
  "events/[slug]/assistant/route.ts": "public event assistant, no rate limit or AI budget yet",
};

// Public on purpose. Each one is rate limited. Add a route here only with a reason.
const PUBLIC_ROUTES: Record<string, string> = {
  "demo/route.ts": "public demo request form, rate limited",
  "khris/reply/route.ts": "public site assistant, rate limited and budget capped",
  "johnny/reply/route.ts": "public site assistant, rate limited and budget capped",
  "scheduling/book/route.ts": "public booking page, rate limited",
  "events/[slug]/register/route.ts": "public event registration, rate limited",
  "ai/route.ts": "public site assistant, rate limited and AI budget capped",
  "assessment/route.ts": "public form, rate limited",
  "auth/forgot-password/route.ts": "public form, rate limited",
  "billing/guest-agreement-preview/route.ts": "public form, rate limited",
  "billing/guest-checkout/route.ts": "public form, rate limited",
  "daniela/reply/route.ts": "public assistant, rate limited and AI budget capped",
  "events/account-check/route.ts": "public form, rate limited",
  "fit/event/route.ts": "public form, rate limited",
  "funnel/route.ts": "public form, rate limited",
  "ir-agent/[agentId]/conversation/route.ts": "public IR agent page, rate limited",
  "jessica/reply/route.ts": "public assistant, rate limited and AI budget capped",
  "jessica2/reply/route.ts": "public assistant, rate limited and AI budget capped",
  "lead/route.ts": "public form, rate limited",
  "michael/reply/route.ts": "public assistant, rate limited and AI budget capped",
  "scheduling/cancel/route.ts": "public form, rate limited",
  "start/resend-login/route.ts": "public form, rate limited",
};

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...routeFiles(full));
    else if (entry.name === "route.ts") out.push(full);
  }
  return out;
}

describe("API route guards", () => {
  const files = routeFiles(API_DIR);

  it("finds the API routes", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("every route checks the caller, verifies a signature, or is on the public list", () => {
    const unguarded: string[] = [];
    for (const file of files) {
      const rel = relative(API_DIR, file).split(sep).join("/");
      if (PUBLIC_ROUTES[rel] || OPEN_ROUTES[rel]) continue;
      const src = readFileSync(file, "utf8");
      // A route that only re-exports another route's handlers is guarded by that route.
      if (/export\s*\{[^}]*\}\s*from\s*["']@\/app\/api\//.test(src)) continue;
      if (!GUARD.test(src) && !SELF_AUTH.test(src)) unguarded.push(rel);
    }
    expect(
      unguarded,
      `These routes have no recognised guard. Add a guard, or add the route to PUBLIC_ROUTES or OPEN_ROUTES with a reason:\n${unguarded.join("\n")}`,
    ).toEqual([]);
  });

  it("every public route is rate limited", () => {
    const missing: string[] = [];
    for (const rel of Object.keys(PUBLIC_ROUTES)) {
      const src = readFileSync(join(API_DIR, ...rel.split("/")), "utf8");
      if (!/rateLimit|RateLimit/.test(src)) missing.push(rel);
    }
    expect(missing).toEqual([]);
  });
});
