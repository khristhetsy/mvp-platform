/**
 * Site audit (Social Media Hub, Overview), staff only.
 *   GET   → { audit }                     latest run, or null
 *   POST  {}                              → { audit }   reads the public company pages and stores proposed findings
 *   PATCH { id }                          → { ok }      staff approve the findings
 *
 * Reads only a fixed list of public pages on icapos.com (or this app's own host). It never
 * fetches an address typed by a user, and it never edits the site.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { AUDIT_PATHS, auditHostAllowed, buildFindings, type AuditPage } from "@/lib/social/site-audit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

const COLS = "id, url, run_at, findings, approved_at";

function baseUrl(): string {
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim();
  try {
    if (app) {
      const u = new URL(app);
      if (u.protocol === "https:" && auditHostAllowed(u.hostname, app)) return `${u.protocol}//${u.host}`;
    }
  } catch { /* fall through to the public site */ }
  return "https://icapos.com";
}

async function readPage(url: string): Promise<AuditPage> {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "User-Agent": "iCapOS-site-audit" } });
    if (!res.ok) return { url, ok: false, html: null };
    const html = (await res.text()).slice(0, 400_000);
    return { url, ok: true, html };
  } catch {
    return { url, ok: false, html: null };
  }
}

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const { data } = await db().from("social_site_audits").select(COLS).order("run_at", { ascending: false }).limit(1);
  return NextResponse.json({ audit: (data ?? [])[0] ?? null });
}

export async function POST(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const root = baseUrl();
  const pages = await Promise.all(AUDIT_PATHS.map((p) => readPage(`${root}${p === "/" ? "/" : p}`)));
  const findings = buildFindings(pages);
  const { data, error } = await db().from("social_site_audits")
    .insert({ url: root, findings, created_by: (profile as { id?: string }).id ?? null }).select(COLS).single();
  if (error) return NextResponse.json({ error: "Couldn't save the audit. Try again." }, { status: 500 });
  return NextResponse.json({ audit: data });
}

const patch = z.object({ id: z.string().uuid() });

export async function PATCH(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = patch.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { error } = await db().from("social_site_audits")
    .update({ approved_by: (profile as { id?: string }).id ?? null, approved_at: new Date().toISOString() }).eq("id", parsed.data.id);
  return error ? NextResponse.json({ error: "Couldn't approve the findings." }, { status: 500 }) : NextResponse.json({ ok: true });
}
