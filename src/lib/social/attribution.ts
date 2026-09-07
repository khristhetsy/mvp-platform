/**
 * Attribution — calls/leads booked by source over the last 8 weeks (build-spec §9).
 * Posts rank by in-range founders, never impressions. Sourced from fit_sessions:
 * the channel is the source_tag prefix (em/li/web), so a booking that came through
 * a LinkedIn post (li-…) counts to LinkedIn, an email (em-…) to Email, etc.
 */

import { createServiceRoleClient } from "@/lib/supabase/admin";

export type WeekBar = { week: string; linkedin: number; email: number; website: number; other: number };

function channelOf(tag: string | null): "linkedin" | "email" | "website" | "other" {
  const p = (tag ?? "").split("-")[0]?.toLowerCase();
  if (p === "li") return "linkedin";
  if (p === "em") return "email";
  if (p === "web") return "website";
  return "other";
}

export async function getAttribution(): Promise<WeekBar[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const since = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000).toISOString();
  // A booking-quality lead = a session that captured an email (the funnel's conversion).
  const { data } = await db.from("fit_sessions").select("source_tag, email, created_at").not("email", "is", null).gte("created_at", since).limit(50000);

  const weeks: WeekBar[] = [];
  for (let i = 7; i >= 0; i--) {
    const start = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
    weeks.push({ week: `W${8 - i}`, linkedin: 0, email: 0, website: 0, other: 0 });
    void start;
  }
  const now = Date.now();
  for (const r of (data ?? []) as { source_tag: string | null; created_at: string }[]) {
    const ageWeeks = Math.floor((now - new Date(r.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000));
    const idx = 7 - Math.min(7, Math.max(0, ageWeeks));
    weeks[idx][channelOf(r.source_tag)] += 1;
  }
  return weeks;
}
