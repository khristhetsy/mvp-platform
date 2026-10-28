import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFounderSocial, ownsAccounts, ownsCampaign, socialDb } from "@/lib/social/founder-auth";
import { createRecurrence, setRecurrenceStatus, upcoming, totalCount, type RecurrenceRule } from "@/lib/social/recurrence";
import { logFounderSocialEvent } from "@/lib/social/activity";
import { actingBlock } from "@/lib/admin/acting-central";

export const dynamic = "force-dynamic";

const MAX_ACTIVE_SERIES = 10;

const schema = z.object({
  freq: z.enum(["daily", "weekly", "monthly"]),
  interval: z.number().int().min(1).max(52),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  timeLocal: z.string().regex(/^\d{1,2}:\d{2}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endType: z.enum(["never", "on_date", "after"]),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  endCount: z.number().int().min(1).max(500).nullish(),
  dryRun: z.boolean().optional(),
  title: z.string().max(120).nullish(),
  campaignId: z.string().uuid().nullish(),
  body: z.string().max(4000).default(""),
  comment: z.string().max(1000).nullish(),
  linkUrl: z.string().url().max(500).nullish(),
  imageUrl: z.string().url().max(1000).nullish(),
  variants: z.array(z.object({ accountId: z.string().uuid(), body: z.string().min(1).max(4000) })).default([]),
});

// The founder's own recurring series.
export async function GET(): Promise<Response> {
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const { data } = await socialDb().from("social_recurrences")
    .select("id, status, freq, interval_n, weekdays, time_local, start_date, end_type, end_date, end_count, next_run, made_count, body, brief")
    .eq("owner_profile_id", auth.founderId).neq("status", "ended").order("created_at", { ascending: false }).limit(50);
  return NextResponse.json({ series: data ?? [] });
}

// A series counts against the monthly limit one post at a time as occurrences are created.
// Occurrences past the limit are kept as drafts for the reset date and never post on their own.
export async function POST(req: NextRequest): Promise<Response> {
  const actingBlocked = await actingBlock();
  if (actingBlocked) return actingBlocked;
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid schedule." }, { status: 400 });
  const d = parsed.data;
  const rule: RecurrenceRule = { freq: d.freq, interval: d.interval, weekdays: d.weekdays, timeLocal: d.timeLocal, startDate: d.startDate, endType: d.endType, endDate: d.endDate ?? null, endCount: d.endCount ?? null };

  if (d.dryRun) return NextResponse.json({ upcoming: upcoming(rule, Date.now(), 6), total: totalCount(rule) });

  if (d.variants.length === 0) return NextResponse.json({ error: "Write the post first." }, { status: 400 });
  if (!(await ownsAccounts(auth.founderId, d.variants.map((v) => v.accountId)))) return NextResponse.json({ error: "Connect an account in Settings first." }, { status: 400 });
  if (d.campaignId && !(await ownsCampaign(auth.founderId, d.campaignId))) return NextResponse.json({ error: "Campaign not found." }, { status: 400 });

  const { count } = await socialDb().from("social_recurrences").select("id", { count: "exact", head: true }).eq("owner_profile_id", auth.founderId).eq("status", "active");
  if ((count ?? 0) >= MAX_ACTIVE_SERIES) return NextResponse.json({ error: `You can keep up to ${MAX_ACTIVE_SERIES} repeating posts at a time.` }, { status: 400 });

  const res = await createRecurrence({
    ...rule, campaignId: d.campaignId ?? null, brief: d.title ?? null, body: d.body, comment: d.comment ?? null,
    linkUrl: d.linkUrl ?? null, imageUrl: d.imageUrl ?? null, variants: d.variants, createdBy: auth.founderId, ownerId: auth.founderId,
  });
  if (!res) return NextResponse.json({ error: "Could not create the repeating post." }, { status: 400 });
  await logFounderSocialEvent({
    type: "founder.social_series_created", founderId: auth.founderId,
    description: `${d.title?.trim() || d.variants[0].body.slice(0, 60)}, ${d.freq}`,
    metadata: { recurrenceId: res.id, freq: d.freq, interval: d.interval },
  });
  return NextResponse.json({ ok: true, id: res.id });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const actingBlocked = await actingBlock();
  if (actingBlocked) return actingBlocked;
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(["active", "paused", "ended"]) }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { data: own } = await socialDb().from("social_recurrences").select("id").eq("id", parsed.data.id).eq("owner_profile_id", auth.founderId).maybeSingle();
  if (!own) return NextResponse.json({ error: "Series not found." }, { status: 404 });
  const ok = await setRecurrenceStatus(parsed.data.id, parsed.data.status);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Could not update the series." }, { status: 400 });
}
