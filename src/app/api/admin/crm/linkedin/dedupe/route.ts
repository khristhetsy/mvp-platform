import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveMx } from "node:dns/promises";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { classifyScreen, domainPart, type ScreenStatus } from "@/lib/ingest/email-screen";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // DNS MX lookup needs the Node runtime, not edge.
export const maxDuration = 60;

// Read-only dedupe + FREE screening for a parsed LinkedIn import. Returns which emails
// already exist in crm_contacts, plus a screen status per email (syntax + MX + disposable
// + role). NO writes, and NO mailbox verification — screening can't confirm an address
// exists, so nothing here promotes or marks anything "verified".
const schema = z.object({ emails: z.array(z.string()).max(20000) });

const MX_DOMAIN_CAP = 600; // bound DNS work so the request can't blow the function timeout

async function hasMxCached(domain: string, cache: Map<string, boolean>): Promise<boolean> {
  const hit = cache.get(domain);
  if (hit !== undefined) return hit;
  let ok = false;
  try {
    const records = await Promise.race([
      resolveMx(domain),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
    ]);
    ok = Array.isArray(records) && records.length > 0;
  } catch {
    ok = false;
  }
  cache.set(domain, ok);
  return ok;
}

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const wanted = [...new Set(parsed.data.emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (wanted.length === 0) return NextResponse.json({ existing: [], screen: {} });

  // ── Dedupe: which emails already exist in the CRM (read-only) ──────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const existing = new Set<string>();
  for (let i = 0; i < wanted.length; i += 500) {
    const chunk = wanted.slice(i, i + 500);
    const { data } = await db.from("crm_contacts").select("email").in("email", chunk);
    for (const r of (data ?? []) as Array<{ email: string | null }>) {
      if (r.email) existing.add(r.email.toLowerCase());
    }
  }

  // ── Screen: MX (bounded, cached per domain) + syntax/disposable/role ───────
  const mxCache = new Map<string, boolean>();
  const domains = [...new Set(wanted.map(domainPart).filter(Boolean))].slice(0, MX_DOMAIN_CAP);
  // Resolve MX with limited concurrency so we don't hammer the resolver.
  for (let i = 0; i < domains.length; i += 12) {
    await Promise.all(domains.slice(i, i + 12).map((d) => hasMxCached(d, mxCache)));
  }

  const screen: Record<string, { status: ScreenStatus; reason: string }> = {};
  for (const email of wanted) {
    const domain = domainPart(email);
    // Domains beyond the MX cap default to unknown-MX → treated as risky, not invalid.
    const mx = mxCache.has(domain) ? mxCache.get(domain)! : true;
    screen[email] = classifyScreen(email, mx);
  }

  return NextResponse.json({ existing: [...existing], screen });
}
