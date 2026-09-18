/**
 * Meeting booking on a Share Project record (scheduler + Google Calendar).
 *   GET  ?host=<staffId>&from=<ISO>&to=<ISO>&duration=<min> → { slots, timezone, durations, hasHours, current }
 *   POST { action: "book" | "reschedule", hostId, startTime, endTime, timezone, note?, notify, custom } → BookResult
 *   POST { action: "cancel", notify } → { ok }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { getMatch, listActivities } from "@/lib/ir/db";
import { bookMeeting, cancelMeeting, hostSlots, meetingSummary, rescheduleMeeting } from "@/lib/ir/meetings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const me = await irStaff();
  if (!me) return forbidden();
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  try {
    const match = await getMatch(id);
    if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
    const hostId = sp.get("host") || match.assignee_id || me.id;
    const from = sp.get("from") ?? new Date().toISOString();
    const to = sp.get("to") ?? new Date(Date.now() + 14 * 86_400_000).toISOString();
    const duration = Number(sp.get("duration")) || undefined;
    const [slots, acts] = await Promise.all([hostSlots(hostId, from, to, duration), listActivities({ matchId: id })]);
    const current = await meetingSummary(match, acts);
    return NextResponse.json({ hostId, ...slots, current });
  } catch (e) { return failed(e, "Couldn't load open slots."); }
}

const bookSchema = z.object({
  action: z.enum(["book", "reschedule"]),
  hostId: z.string().uuid(),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  timezone: z.string().min(1).max(64),
  note: z.string().max(2000).nullish(),
  notify: z.boolean().default(true),
  custom: z.boolean().default(false),
});
const cancelSchema = z.object({ action: z.literal("cancel"), notify: z.boolean().default(true) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const me = await irStaff();
  if (!me) return forbidden();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  try {
    if (body?.action === "cancel") {
      const p = cancelSchema.safeParse(body);
      if (!p.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
      await cancelMeeting({ matchId: id, notify: p.data.notify, by: me.id });
      return NextResponse.json({ ok: true });
    }
    const p = bookSchema.safeParse(body);
    if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Invalid booking." }, { status: 400 });
    if (Date.parse(p.data.endTime) <= Date.parse(p.data.startTime)) return NextResponse.json({ error: "The meeting must end after it starts." }, { status: 400 });
    if (Date.parse(p.data.startTime) < Date.now() - 5 * 60_000) return NextResponse.json({ error: "Pick a time in the future." }, { status: 400 });
    const input = { matchId: id, hostId: p.data.hostId, startTime: p.data.startTime, endTime: p.data.endTime, timezone: p.data.timezone, note: p.data.note ?? null, notify: p.data.notify, custom: p.data.custom, by: me.id };
    const result = p.data.action === "book" ? await bookMeeting(input) : await rescheduleMeeting(input);
    return NextResponse.json(result);
  } catch (e) { return failed(e, "Couldn't book the meeting."); }
}
