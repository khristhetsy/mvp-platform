/**
 * Conversation finder (Social Media Hub), staff only.
 *   GET  → { signals, hits }
 *   POST { action: "signal_add", phrase, platform? }              → { signal }
 *   POST { action: "signal_remove", id }                          → { ok }
 *   POST { action: "hit_add", threadUrl, excerpt, authorHandle?, audience? } → { hit }
 *   POST { action: "hit_status", id, status: "replied" | "skipped" }         → { ok }
 *
 * The finder never posts anything. Replies are written and posted by staff through the
 * existing Reddit reply composer. Investor conversations are saved as "held": no public reply.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { classifyAudience, cleanExcerpt, initialStatus, matchSignal, scoreHit, validateThreadUrl, type FinderHit, type FinderSignal } from "@/lib/social/finder";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

const HIT_COLS = "id, platform, thread_url, author_handle, excerpt, signal_id, audience, match_level, status, created_at";

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const [s, h] = await Promise.all([
    db().from("social_finder_signals").select("id, phrase, platform, active").order("created_at", { ascending: true }).limit(100),
    db().from("social_finder_hits").select(HIT_COLS).order("created_at", { ascending: false }).limit(200),
  ]);
  return NextResponse.json({ signals: (s.data ?? []) as FinderSignal[], hits: (h.data ?? []) as FinderHit[] });
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("signal_add"), phrase: z.string().trim().min(2).max(120), platform: z.enum(["any", "reddit", "linkedin", "x"]).default("any") }),
  z.object({ action: z.literal("signal_remove"), id: z.string().uuid() }),
  z.object({
    action: z.literal("hit_add"),
    threadUrl: z.string().trim().max(500),
    excerpt: z.string().trim().min(1).max(2000),
    authorHandle: z.string().trim().max(80).optional(),
    audience: z.enum(["founder", "investor"]).optional(),
  }),
  z.object({ action: z.literal("hit_status"), id: z.string().uuid(), status: z.enum(["replied", "skipped"]) }),
]);

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const input = parsed.data;
  const staffId = (profile as { id?: string }).id ?? null;

  if (input.action === "signal_add") {
    const { data, error } = await db().from("social_finder_signals")
      .insert({ phrase: input.phrase, platform: input.platform, created_by: staffId }).select("id, phrase, platform, active").single();
    if (error) {
      const dup = (error as { code?: string }).code === "23505";
      return NextResponse.json({ error: dup ? "That phrase is already on the list." : "Couldn't save the phrase." }, { status: dup ? 409 : 500 });
    }
    return NextResponse.json({ signal: data });
  }

  if (input.action === "signal_remove") {
    const { error } = await db().from("social_finder_signals").delete().eq("id", input.id);
    return error ? NextResponse.json({ error: "Couldn't remove the phrase." }, { status: 500 }) : NextResponse.json({ ok: true });
  }

  if (input.action === "hit_add") {
    const link = validateThreadUrl(input.threadUrl);
    if (!link.ok) return NextResponse.json({ error: link.error }, { status: 400 });
    const excerpt = cleanExcerpt(input.excerpt);
    if (!excerpt) return NextResponse.json({ error: "Paste a line or two from the conversation." }, { status: 400 });

    const { data: sig } = await db().from("social_finder_signals").select("id, phrase, platform, active").eq("active", true).limit(100);
    const match = matchSignal(excerpt, link.platform, (sig ?? []) as FinderSignal[]);
    const audience = input.audience ?? classifyAudience(excerpt);
    const row = {
      platform: link.platform,
      thread_url: input.threadUrl.trim(),
      author_handle: input.authorHandle || null,
      excerpt,
      signal_id: match?.id ?? null,
      audience,
      match_level: scoreHit({ audience, matched: Boolean(match), text: excerpt }),
      status: initialStatus(audience),
      created_by: staffId,
    };
    const { data, error } = await db().from("social_finder_hits").insert(row).select(HIT_COLS).single();
    if (error) {
      const dup = (error as { code?: string }).code === "23505";
      return NextResponse.json({ error: dup ? "That conversation is already on the list." : "Couldn't save the conversation." }, { status: dup ? 409 : 500 });
    }
    return NextResponse.json({ hit: data });
  }

  const { error } = await db().from("social_finder_hits")
    .update({ status: input.status, reviewed_by: staffId, reviewed_at: new Date().toISOString() }).eq("id", input.id);
  return error ? NextResponse.json({ error: "Couldn't update the conversation." }, { status: 500 }) : NextResponse.json({ ok: true });
}
