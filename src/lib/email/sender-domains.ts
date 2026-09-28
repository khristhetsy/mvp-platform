// Which domains iCapOS may send "as" a person (From: Khris Thetsy <kthetsy@myicfos.com>).
// Resend only delivers From addresses on domains verified in the Resend account, so a
// person's own address is used only when its domain is verified; otherwise the send
// falls back to the platform address with the person's name.
//
// Sources, merged: RESEND_SENDER_DOMAINS (comma separated, e.g. "icapos.com,myicfos.com")
// and the account's verified domains from the Resend API (needs a full access API key;
// a sending-only key just skips this). Cached for 10 minutes.

const RESEND_DOMAINS_API = "https://api.resend.com/domains";
const CACHE_MS = 10 * 60 * 1000;
let cache: { at: number; domains: Set<string> } | null = null;

function envDomains(): string[] {
  return (process.env.RESEND_SENDER_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export async function verifiedSenderDomains(): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.domains;
  const domains = new Set(envDomains());
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(RESEND_DOMAINS_API, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const json = (await res.json()) as { data?: Array<{ name?: string; status?: string }> };
        for (const d of json.data ?? []) if (d.name && d.status === "verified") domains.add(d.name.toLowerCase());
      }
    } catch { /* fall back to the env list */ }
  }
  cache = { at: Date.now(), domains };
  return domains;
}

/** Test hook. */
export function resetSenderDomainCache(): void { cache = null; }

/**
 * "Name <address>" for the person's own address when its domain (or a parent domain)
 * is verified; null when it can't be used and the platform address must be.
 */
export function personalFromHeader(name: string | null | undefined, email: string | null | undefined, domains: Set<string>): string | null {
  const address = (email ?? "").trim().toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) return null;
  const domain = address.split("@")[1];
  const ok = [...domains].some((d) => domain === d || domain.endsWith(`.${d}`));
  if (!ok) return null;
  const clean = (name ?? "").replace(/[<>"]/g, "").trim();
  return clean ? `${clean} <${address}>` : address;
}
