import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Reads one home page so an admin can check a fund's industries. Server side
 * only, one page, text only. Refuses private and local addresses (SSRF),
 * re-checks every redirect, and stops after 6 seconds or about 200 KB.
 */
const MAX_BYTES = 200_000;
const MAX_REDIRECTS = 3;

function privateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const l = ip.toLowerCase();
    return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("::ffff:127.") || l.startsWith("::ffff:10.") || l.startsWith("::ffff:192.168.") || l.startsWith("::ffff:169.254.");
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function safeUrl(raw: string): Promise<URL> {
  const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only web addresses can be read.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("That address can't be read.");
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  if (!ips.length || ips.some(privateIp)) throw new Error("That address can't be read.");
  return u;
}

function toText(html: string): string {
  const pick = (re: RegExp) => (re.exec(html)?.[1] ?? "").trim();
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const meta = pick(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || pick(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const heads = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].slice(0, 12).map((m) => m[1]);
  const body = html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");
  const clean = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&amp;|&#\d+;/g, " ").replace(/\s+/g, " ").trim();
  const lead = clean(body).slice(0, 600);
  return clean([title, meta, heads.join(". "), lead].filter(Boolean).join(". ")).slice(0, 1500);
}

export async function fetchSiteText(website: string): Promise<{ url: string; text: string }> {
  let url = await safeUrl(website);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    try {
      const res = await fetch(url, { redirect: "manual", signal: ctl.signal, headers: { "User-Agent": "iCapOS-DirectoryCheck/1.0", Accept: "text/html" } });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) throw new Error("The site redirected without a destination.");
        url = await safeUrl(new URL(loc, url).toString());
        continue;
      }
      if (!res.ok) throw new Error(`The site answered ${res.status}.`);
      const type = res.headers.get("content-type") ?? "";
      if (!/text\/html|text\/plain|xhtml/i.test(type)) throw new Error("The home page isn't a text page.");
      const reader = res.body?.getReader();
      let html = "";
      let bytes = 0;
      if (reader) {
        const dec = new TextDecoder();
        while (bytes < MAX_BYTES) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          html += dec.decode(value, { stream: true });
        }
        void reader.cancel().catch(() => {});
      }
      const text = toText(html);
      if (!text) throw new Error("No readable text on the home page.");
      return { url: url.toString(), text };
    } catch (err) {
      if ((err as Error).name === "AbortError") throw new Error("The site took too long to answer.");
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Too many redirects.");
}
