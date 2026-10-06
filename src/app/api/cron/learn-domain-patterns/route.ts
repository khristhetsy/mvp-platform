import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { withCronGate, CRON_SUMMARY_HEADER } from "@/lib/cron/gate";
import { getCronSecret, validateCronSecret, cronUnauthorizedResponse, cronMisconfiguredResponse } from "@/lib/notifications/cron/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { learnFromKnownEmails } from "@/lib/append/domain-patterns";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Rebuild at most once per this many hours; runs sooner when nothing has been learned yet. */
const REFRESH_HOURS = 20;

// Company email formats: rebuilds email_domain_patterns from every known email in the
// CRM (spec 5.2), so the contact finder guesses with each company's real format
// without anyone pressing "Learn from existing contacts". Scheduled hourly in
// vercel.json, but only does the work when the table is empty or older than
// REFRESH_HOURS. Recomputes from scratch, so a run is always safe. Pause it under
// Admin › System › Scheduled jobs. CRON_SECRET protected.
async function learnPatternsGET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  const db = serviceRoleClientUntyped();
  try {
    const { data: latest, error: readErr } = await db
      .from("email_domain_patterns")
      .select("last_checked_at")
      .order("last_checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    const last = (latest as { last_checked_at?: string } | null)?.last_checked_at;
    if (last && Date.now() - new Date(last).getTime() < REFRESH_HOURS * 3_600_000) {
      const res = NextResponse.json({ skipped: true, lastLearnedAt: last });
      res.headers.set(CRON_SUMMARY_HEADER, `Up to date (last learned ${last.slice(0, 16).replace("T", " ")} UTC)`);
      return res;
    }

    const started = Date.now();
    const r = await learnFromKnownEmails(db);
    const res = NextResponse.json({ ...r, ms: Date.now() - started });
    res.headers.set(CRON_SUMMARY_HEADER, `${r.scanned} contacts read, ${r.matched} fit a format, ${r.domains} domains, ${r.learned} learned`);
    return res;
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Learning failed." }, { status: 500 });
  }
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/learn-domain-patterns", learnPatternsGET);
