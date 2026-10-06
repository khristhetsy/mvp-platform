/**
 * /api/sales/contacts/profile-fill — LinkedIn contact profile fill.
 *
 * GET  ?group=all|investor|other     → { queue: [{ contactId, pending }], stats }
 * GET  ?id=<contact id>              → one contact's pending proposals
 * POST { mode: "load", kind, text }  → match a research or found-contacts file to contacts
 * POST { mode: "decide", contactId, decisions: [{ id, accept, value? }] } → accept or reject
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { decide, fillStats, loadFile, reviewItem, reviewQueue } from "@/lib/contacts/profile-fill/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const item = await reviewItem(id);
      return item ? NextResponse.json(item) : NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }
    const g = req.nextUrl.searchParams.get("group");
    const group = g === "investor" || g === "other" ? g : "all";
    const [queue, stats] = await Promise.all([reviewQueue(group), fillStats()]);
    return NextResponse.json({ queue, stats });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load." }, { status: 500 });
  }
}

const loadSchema = z.object({ mode: z.literal("load"), kind: z.enum(["research", "found"]), text: z.string().min(10).max(8_000_000) });
const decideSchema = z.object({
  mode: z.literal("decide"),
  contactId: z.string().uuid(),
  decisions: z.array(z.object({ id: z.string().uuid(), accept: z.boolean(), value: z.union([z.string().max(5000), z.array(z.string().max(200))]).optional() })).min(1).max(50),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const l = loadSchema.safeParse(body);
  if (l.success) {
    if (profile.role !== "admin") return NextResponse.json({ error: "Only admins can load files." }, { status: 403 });
    try { return NextResponse.json(await loadFile(l.data.text, l.data.kind)); }
    catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load the file." }, { status: 400 }); }
  }
  const d = decideSchema.safeParse(body);
  if (!d.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    return NextResponse.json(await decide(d.data.contactId, d.data.decisions, { id: profile.id, isAdmin: profile.role === "admin" }));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save." }, { status: 500 });
  }
}
