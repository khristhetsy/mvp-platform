import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { learnFromKnownEmails, LEARNED_MIN_SAMPLES } from "@/lib/append/domain-patterns";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/prospects/domain-patterns?learned=1 — domain formats, most samples first
// (up to 2,000; the page filters these as you type).
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const db = serviceRoleClientUntyped();
  let query = db.from("email_domain_patterns")
    .select("domain, pattern, format_counts, verified_samples, conflicting_samples, catch_all, last_checked_at", { count: "exact" })
    .order("verified_samples", { ascending: false })
    .order("domain")
    .limit(2000);
  if (sp.get("learned") === "1") query = query.gte("verified_samples", LEARNED_MIN_SAMPLES).eq("conflicting_samples", 0);
  const { data, count, error } = await query;
  if (error) return NextResponse.json({ rows: [], total: 0, error: error.message });
  const { count: learned } = await db.from("email_domain_patterns").select("domain", { count: "exact", head: true }).gte("verified_samples", LEARNED_MIN_SAMPLES).eq("conflicting_samples", 0);
  const { count: all } = await db.from("email_domain_patterns").select("domain", { count: "exact", head: true });
  return NextResponse.json({ rows: data ?? [], total: count ?? 0, learned: learned ?? 0, domains: all ?? 0 });
}

// POST /api/prospects/domain-patterns — rebuild from every known email (safe to re-run).
export async function POST(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  try {
    return NextResponse.json(await learnFromKnownEmails(serviceRoleClientUntyped()));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Learning failed." }, { status: 500 });
  }
}
