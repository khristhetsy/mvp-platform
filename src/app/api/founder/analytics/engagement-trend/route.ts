import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export type EngagementWeek = {
  label: string;
  weekStart: string; // ISO date string
  viewed: number;
  saved: number;
  interested: number;
  intro_requested: number;
};

export type EngagementTrendResult = {
  weeks: EngagementWeek[];
};

/** Return the Monday of the week containing `d`. */
function weekMonday(d: Date): Date {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const dow = day.getDay(); // 0=Sun
  const offset = dow === 0 ? -6 : 1 - dow;
  day.setDate(day.getDate() + offset);
  return day;
}

/** Build 8 weekly bucket descriptors, oldest first. */
function buildBuckets(): Array<{ label: string; start: Date; end: Date; key: string }> {
  const thisMonday = weekMonday(new Date());
  const buckets = [];
  for (let i = 7; i >= 0; i--) {
    const start = new Date(thisMonday);
    start.setDate(thisMonday.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const label = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    buckets.push({ label, start, end, key: start.toISOString() });
  }
  return buckets;
}

function bucket(dates: string[], buckets: ReturnType<typeof buildBuckets>): number[] {
  const counts = new Array<number>(buckets.length).fill(0);
  for (const iso of dates) {
    const d = new Date(iso);
    for (let i = 0; i < buckets.length; i++) {
      if (d >= buckets[i].start && d < buckets[i].end) {
        counts[i]++;
        break;
      }
    }
  }
  return counts;
}

export async function GET() {
  let profile;
  try {
    profile = await requireRole(["founder"]);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let company;
  try {
    company = await ensureFounderCompanyForUser(profile);
  } catch {
    return NextResponse.json({ weeks: [] } satisfies EngagementTrendResult);
  }

  if (!company) {
    return NextResponse.json({ weeks: [] } satisfies EngagementTrendResult);
  }

  const admin = createServiceRoleClient();
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
  const cutoff = eightWeeksAgo.toISOString();

  const [viewsResult, savesResult, interestsResult, introsResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from("investor_activity")
      .select("created_at")
      .eq("company_id", company.id)
      .eq("activity_type", "report_viewed")
      .gte("created_at", cutoff),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from("saved_deals")
      .select("created_at")
      .eq("company_id", company.id)
      .gte("created_at", cutoff),

    admin
      .from("investor_interests")
      .select("created_at")
      .eq("company_id", company.id)
      .gte("created_at", cutoff),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from("intro_requests")
      .select("created_at")
      .eq("company_id", company.id)
      .gte("created_at", cutoff),
  ]);

  const extract = (res: { data: Array<{ created_at: string }> | null }) =>
    (res.data ?? []).map((r) => r.created_at);

  const views     = extract(viewsResult     as { data: Array<{ created_at: string }> | null });
  const saves     = extract(savesResult     as { data: Array<{ created_at: string }> | null });
  const interests = extract(interestsResult as { data: Array<{ created_at: string }> | null });
  const intros    = extract(introsResult    as { data: Array<{ created_at: string }> | null });

  const buckets = buildBuckets();
  const viewCounts     = bucket(views,     buckets);
  const saveCounts     = bucket(saves,     buckets);
  const interestCounts = bucket(interests, buckets);
  const introCounts    = bucket(intros,    buckets);

  const weeks: EngagementWeek[] = buckets.map((b, i) => ({
    label:          b.label,
    weekStart:      b.key,
    viewed:         viewCounts[i],
    saved:          saveCounts[i],
    interested:     interestCounts[i],
    intro_requested: introCounts[i],
  }));

  return NextResponse.json({ weeks } satisfies EngagementTrendResult);
}
