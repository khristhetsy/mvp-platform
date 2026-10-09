/**
 * Server only: a thin Plaid REST client for the Accounting bank feed. Read
 * only (Transactions and account balances). No SDK, so no new dependency.
 *
 * Env (Vercel, server side only):
 *   PLAID_CLIENT_ID, PLAID_SECRET   from dashboard.plaid.com, Developers, Keys
 *   PLAID_ENV                       "production" (default) or "sandbox"
 *   PLAID_REDIRECT_URI              optional; only if Plaid asks for an OAuth redirect
 *
 * The free Trial plan (teams created on or after Apr 15, 2026) allows up to 10
 * connected Items, Bank of America included.
 */

export type PlaidEnv = "production" | "sandbox";

export function plaidConfig(): { clientId: string; secret: string; env: PlaidEnv; redirectUri: string | null } | null {
  const clientId = process.env.PLAID_CLIENT_ID?.trim();
  const secret = process.env.PLAID_SECRET?.trim();
  if (!clientId || !secret) return null;
  const env: PlaidEnv = process.env.PLAID_ENV?.trim().toLowerCase() === "sandbox" ? "sandbox" : "production";
  return { clientId, secret, env, redirectUri: process.env.PLAID_REDIRECT_URI?.trim() || null };
}

export function plaidConfigured(): boolean {
  return plaidConfig() !== null;
}

export class PlaidError extends Error {
  constructor(message: string, readonly code: string | null, readonly status: number) {
    super(message);
  }
  /** The bank wants the person to sign in again (password change, MFA, consent expiry). */
  get needsLogin(): boolean {
    return this.code === "ITEM_LOGIN_REQUIRED" || this.code === "PENDING_EXPIRATION" || this.code === "ITEM_NOT_FOUND";
  }
}

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const cfg = plaidConfig();
  if (!cfg) throw new PlaidError("Plaid is not set up yet. Add PLAID_CLIENT_ID and PLAID_SECRET in Vercel.", "NOT_CONFIGURED", 500);
  const res = await fetch(`https://${cfg.env}.plaid.com${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: cfg.clientId, secret: cfg.secret, ...body }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.display_message as string) || (data.error_message as string) || `Plaid request failed (${res.status}).`;
    throw new PlaidError(msg, (data.error_code as string) ?? null, res.status);
  }
  return data as T;
}

/** A Link token for the browser. With an access token, Link opens in update mode to reconnect. */
export async function createLinkToken(userId: string, accessToken?: string): Promise<string> {
  const cfg = plaidConfig();
  const body: Record<string, unknown> = {
    client_name: "iCapOS",
    user: { client_user_id: userId },
    country_codes: ["US"],
    language: "en",
  };
  if (accessToken) body.access_token = accessToken;
  else {
    body.products = ["transactions"];
    body.transactions = { days_requested: 730 };
  }
  if (cfg?.redirectUri) body.redirect_uri = cfg.redirectUri;
  const r = await call<{ link_token: string }>("/link/token/create", body);
  return r.link_token;
}

export async function exchangePublicToken(publicToken: string): Promise<{ accessToken: string; itemId: string }> {
  const r = await call<{ access_token: string; item_id: string }>("/item/public_token/exchange", { public_token: publicToken });
  return { accessToken: r.access_token, itemId: r.item_id };
}

export type PlaidAccount = {
  account_id: string;
  name: string;
  official_name?: string | null;
  mask: string | null;
  type: string;
  subtype: string | null;
  balances: { current: number | null; available: number | null };
};

export async function getAccounts(accessToken: string): Promise<PlaidAccount[]> {
  const r = await call<{ accounts: PlaidAccount[] }>("/accounts/get", { access_token: accessToken });
  return r.accounts ?? [];
}

export type PlaidTransaction = {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string | null;
  pending: boolean;
};

/** Every change since `cursor`, paging until has_more is false. */
export async function syncTransactions(accessToken: string, cursor: string | null): Promise<{
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: string[];
  nextCursor: string | null;
}> {
  const added: PlaidTransaction[] = [];
  const modified: PlaidTransaction[] = [];
  const removed: string[] = [];
  let next = cursor;
  for (let page = 0; page < 40; page++) {
    const body: Record<string, unknown> = { access_token: accessToken, count: 500 };
    if (next) body.cursor = next;
    const r = await call<{
      added: PlaidTransaction[];
      modified: PlaidTransaction[];
      removed: Array<{ transaction_id: string }>;
      next_cursor: string;
      has_more: boolean;
    }>("/transactions/sync", body);
    added.push(...(r.added ?? []));
    modified.push(...(r.modified ?? []));
    removed.push(...(r.removed ?? []).map((x) => x.transaction_id));
    next = r.next_cursor ?? next;
    if (!r.has_more) break;
  }
  return { added, modified, removed, nextCursor: next };
}

export async function removeItem(accessToken: string): Promise<void> {
  await call("/item/remove", { access_token: accessToken });
}
