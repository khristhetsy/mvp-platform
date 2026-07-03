// Thin server-side Odoo external API client (JSON-RPC). Credentials come from
// env and never reach the browser. Dormant until all four vars are set.

const ODOO_URL = process.env.ODOO_URL;
const ODOO_DB = process.env.ODOO_DB;
const ODOO_USERNAME = process.env.ODOO_USERNAME;
const ODOO_API_KEY = process.env.ODOO_API_KEY;

export function odooConfigured(): boolean {
  return Boolean(ODOO_URL && ODOO_DB && ODOO_USERNAME && ODOO_API_KEY);
}

async function jsonRpc(service: string, method: string, args: unknown[]): Promise<unknown> {
  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: Date.now(),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json()) as { result?: unknown; error?: { data?: { message?: string }; message?: string } };
  if (json.error) {
    throw new Error(json.error.data?.message ?? json.error.message ?? "Odoo RPC error");
  }
  return json.result;
}

let cachedUid: number | null = null;

async function authenticate(): Promise<number> {
  if (cachedUid) return cachedUid;
  const uid = (await jsonRpc("common", "authenticate", [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}])) as number | false;
  if (!uid) throw new Error("Odoo authentication failed (check user / API key).");
  cachedUid = uid;
  return uid;
}

/** Call a model method, e.g. executeKw("res.partner","search_read",[domain,fields],{limit}). */
export async function executeKw<T = unknown>(
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown> = {},
): Promise<T> {
  const uid = await authenticate();
  return (await jsonRpc("object", "execute_kw", [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs])) as T;
}
