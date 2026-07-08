// Thin server-side Odoo external API client (JSON-RPC). Credentials come from
// env and never reach the browser. Dormant until all four vars are set.

// Normalize: strip a trailing slash so we never build `…//jsonrpc`.
const ODOO_URL = process.env.ODOO_URL?.replace(/\/+$/, "");
const ODOO_DB = process.env.ODOO_DB;
const ODOO_USERNAME = process.env.ODOO_USERNAME;
const ODOO_API_KEY = process.env.ODOO_API_KEY;

export function odooConfigured(): boolean {
  return Boolean(ODOO_URL && ODOO_DB && ODOO_USERNAME && ODOO_API_KEY);
}

// Opt-in escape hatch: connect even if the Odoo host's TLS certificate is
// expired/self-signed. OFF by default. Only for a self-managed Odoo behind a
// lapsed cert — a temporary bridge, not a permanent setting (traffic is no
// longer certificate-verified). Renew the cert or use the .odoo.com host, then
// remove ODOO_INSECURE_TLS.
const INSECURE_TLS = /^(1|true|yes)$/i.test(process.env.ODOO_INSECURE_TLS ?? "");
let insecureDispatcher: unknown;
async function getDispatcher(): Promise<unknown> {
  if (!INSECURE_TLS) return undefined;
  if (insecureDispatcher === undefined) {
    try {
      // Hide the specifier from the bundler entirely (indirect dynamic import) so
      // `undici` is resolved only at runtime — it's an optional peer, never bundled.
      // If it isn't installed, this throws and we fall back to normal fetch below.
      const dynamicImport = new Function("s", "return import(s)") as (s: string) => Promise<unknown>;
      const undici = (await dynamicImport("undici")) as { Agent: new (o: unknown) => unknown };
      insecureDispatcher = new undici.Agent({ connect: { rejectUnauthorized: false } });
    } catch {
      insecureDispatcher = null;
    }
  }
  return insecureDispatcher ?? undefined;
}

async function jsonRpc(service: string, method: string, args: unknown[]): Promise<unknown> {
  const endpoint = `${ODOO_URL}/jsonrpc`;
  let res: Response;
  try {
    const opts: RequestInit & { dispatcher?: unknown } = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: { service, method, args },
        id: Date.now(),
      }),
      signal: AbortSignal.timeout(20_000),
    };
    const dispatcher = await getDispatcher();
    if (dispatcher) opts.dispatcher = dispatcher;
    res = await fetch(endpoint, opts as RequestInit);
  } catch (err) {
    // undici surfaces network failures as a bare "fetch failed" — dig out the
    // real cause (DNS, refused, TLS, timeout) so the admin can act on it.
    const cause = (err as { cause?: { code?: string; message?: string } })?.cause;
    const detail = cause?.code || cause?.message || (err instanceof Error ? err.message : "unknown");
    throw new Error(`Could not reach ${endpoint} — ${detail}. Check ODOO_URL (must be the API host, e.g. https://<db>.odoo.com, reachable from the server).`);
  }
  if (res.status === 404) {
    throw new Error(`${endpoint} returned 404 — this host has no JSON-RPC endpoint. Use your Odoo API host (often https://<database>.odoo.com), not the website/custom domain.`);
  }
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
