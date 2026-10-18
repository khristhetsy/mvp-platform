// GET  /api/mobile/reminders           the founder's reminders, grouped Late / Today / Future, with the PT label
// POST /api/mobile/reminders           { title, kind, date: "YYYY-MM-DD", time: "HH:MM" } (PT wall time)
// Same handlers as the website clock icon (/api/reminders). Authorization: Bearer <supabase access token>.
import { NextResponse } from "next/server";
import { GET as siteGet, POST as sitePost } from "@/app/api/reminders/route";
import { formatReminderDue, ptTimeOf, ptToday, ptWallToIso, reminderGroup } from "@/lib/reminders/pt";
import type { Reminder } from "@/lib/reminders/types";
import { asFounder, withJson } from "../_proxy";

export const dynamic = "force-dynamic";

function enrich(r: Reminder, now = new Date()) {
  return {
    id: r.id,
    title: r.title,
    kind: r.kind,
    dueAt: r.due_at,
    done: Boolean(r.done_at),
    group: reminderGroup(r.due_at, now),
    label: formatReminderDue(r.due_at, now),
    date: ptToday(new Date(r.due_at)),
    time: ptTimeOf(r.due_at),
    source: r.source ?? "reminder",
    context: r.context ?? null,
    href: r.href ?? null,
  };
}

export function GET(req: Request) {
  return asFounder(req, async () => {
    const res = await siteGet();
    if (!res.ok) return res;
    const data = (await res.json()) as { reminders?: Reminder[] };
    const now = new Date();
    return NextResponse.json({ reminders: (data.reminders ?? []).map((r) => enrich(r, now)), today: ptToday(now) }, { headers: { "Cache-Control": "no-store" } });
  });
}

export function POST(req: Request) {
  return asFounder(req, async () => {
    const b = (await req.json().catch(() => null)) as { title?: unknown; kind?: unknown; date?: unknown; time?: unknown } | null;
    const dueAt = ptWallToIso(typeof b?.date === "string" && b.date ? b.date : ptToday(), typeof b?.time === "string" && b.time ? b.time : "09:00");
    if (!dueAt) return NextResponse.json({ error: "Pick a date and time." }, { status: 400 });
    return sitePost(withJson(req, { title: b?.title, kind: b?.kind, dueAt }));
  });
}
