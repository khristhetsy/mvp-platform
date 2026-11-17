// Server-side client for the separate cloud sender service. The admin token stays on the server and is never sent to the browser.

export type CloudSenderConfig = { url: string; token: string };

export type CloudAccount = { id: string; label: string; status: string; invites_today: number; invites_per_day: number | null };
export type CloudCampaign = { id: string; name: string; status: "dry_run" | "running" | "paused" | "archived"; leads: number; accepted: number; replies: number };
export type CloudLead = {
  id: string; profile_url: string; full_name: string | null; external_ref: string | null; state: string;
  invited_at: string | null; accepted_at: string | null; replied_at: string | null;
};
export type CloudLeadInput = { url: string; externalRef?: string; fullName?: string };

export class CloudSenderError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Settings from the environment, or null when the sender is not set up. The address must be https, or http on this machine. */
export function cloudSenderConfig(env: Record<string, string | undefined> = process.env): CloudSenderConfig | null {
  const raw = env.CLOUD_SENDER_URL?.trim();
  const token = env.CLOUD_SENDER_TOKEN?.trim();
  if (!raw || !token) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return null;
  return { url: u.origin, token };
}

type Fetcher = typeof fetch;

export async function senderCall<T>(cfg: CloudSenderConfig, method: "GET" | "POST", path: string, body?: unknown, fetcher: Fetcher = fetch): Promise<T> {
  let res: Response;
  try {
    res = await fetcher(cfg.url + path, {
      method,
      headers: { authorization: `Bearer ${cfg.token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new CloudSenderError("Can't reach the sender. Is it running and the tunnel up?", 502);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 401) throw new CloudSenderError("The sender refused the token. Check CLOUD_SENDER_TOKEN.", 502);
  if (!res.ok) throw new CloudSenderError(data.error ?? "The sender returned an error.", res.status >= 500 ? 502 : res.status);
  return data as T;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string): boolean => UUID.test(s);

export const listAccounts = (c: CloudSenderConfig, f?: Fetcher) => senderCall<CloudAccount[]>(c, "GET", "/api/accounts", undefined, f);
export const listCampaigns = (c: CloudSenderConfig, f?: Fetcher) => senderCall<CloudCampaign[]>(c, "GET", "/api/campaigns", undefined, f);
export const listLeads = (c: CloudSenderConfig, id: string, f?: Fetcher) => senderCall<CloudLead[]>(c, "GET", `/api/campaigns/${id}/leads`, undefined, f);
export const addLeads = (c: CloudSenderConfig, id: string, leads: CloudLeadInput[], f?: Fetcher) =>
  senderCall<{ added: number; skipped: string[] }>(c, "POST", `/api/campaigns/${id}/leads`, { leads }, f);
export const setStatus = (c: CloudSenderConfig, id: string, status: CloudCampaign["status"], f?: Fetcher) =>
  senderCall<{ ok: true }>(c, "POST", `/api/campaigns/${id}/status`, { status }, f);

/** A new campaign is one invite step, sent from every connected sender. It always starts as a dry run. */
export async function createCampaign(c: CloudSenderConfig, name: string, note: string | undefined, f?: Fetcher): Promise<string> {
  const accounts = await listAccounts(c, f);
  const ready = accounts.filter((a) => a.status === "connected" || a.status === "warming_up");
  if (!ready.length) throw new CloudSenderError("No sender account is signed in on the sender yet.", 409);
  const step = note?.trim() ? { type: "invite", waitDays: 0, note: note.trim() } : { type: "invite", waitDays: 0 };
  const r = await senderCall<{ id: string }>(c, "POST", "/api/campaigns", { name, steps: [step], accountIds: ready.map((a) => a.id) }, f);
  return r.id;
}
