/**
 * Who clicked a campaign's links. Staff-only.
 *   GET ?tag=<source_tag> → { total, identified: [...], anonymous }
 *
 * Social clicks are anonymous at click time (one public link, no per-person token).
 * We can only name the people who then identified themselves on /fit (submitted an
 * email) — those become "identified"; the remaining tracked clicks are "anonymous".
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export type Clicker = { email: string; name: string | null; company: string | null; contactId: string | null; at: string | null; stage: string | null };

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const tag = new URL(req.url).searchParams.get("tag");
  if (!tag) return NextResponse.json({ error: "Missing tag." }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;

  const [{ count: total }, sessionsRes] = await Promise.all([
    db.from("social_clicks").select("id", { count: "exact", head: true }).eq("source_tag", tag),
    db.from("fit_sessions").select("email, created_at, stage").eq("source_tag", tag).not("email", "is", null).order("created_at", { ascending: false }).limit(1000),
  ]);

  // De-dupe by email, newest first.
  const byEmail = new Map<string, { email: string; at: string | null; stage: string | null }>();
  for (const s of (sessionsRes.data ?? []) as { email: string | null; created_at: string | null; stage: string | null }[]) {
    const em = (s.email ?? "").trim().toLowerCase();
    if (em && !byEmail.has(em)) byEmail.set(em, { email: em, at: s.created_at ?? null, stage: s.stage ?? null });
  }
  const emails = [...byEmail.keys()];

  const contactByEmail = new Map<string, { id: string; name: string | null; company: string | null }>();
  if (emails.length) {
    const { data: contacts } = await db.from("crm_contacts").select("id, name, email, company").in("email", emails);
    for (const c of (contacts ?? []) as { id: string; name: string | null; email: string | null; company: string | null }[]) {
      const em = (c.email ?? "").trim().toLowerCase();
      if (em) contactByEmail.set(em, { id: c.id, name: c.name ?? null, company: c.company ?? null });
    }
  }

  const identified: Clicker[] = emails.map((em) => {
    const s = byEmail.get(em)!;
    const c = contactByEmail.get(em);
    return { email: em, name: c?.name ?? null, company: c?.company ?? null, contactId: c?.id ?? null, at: s.at, stage: s.stage };
  });

  const totalClicks = total ?? 0;
  return NextResponse.json({ total: totalClicks, identified, anonymous: Math.max(0, totalClicks - identified.length) });
}
