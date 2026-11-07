import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { loadWeeklyContext, previewExamples } from "@/lib/private-market/weekly-data";
import { markNextRunReviewed, saveWeekly, sendTestEmail, type WeeklySaveInput } from "@/lib/private-market/weekly-store";
import { AUDIENCES, type Audience, type WeeklyEmailConfig } from "@/lib/private-market/weekly-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const isAudience = (v: unknown): v is Audience => AUDIENCES.includes(v as Audience);

/**
 * POST /api/admin/private-market/weekly-emailer
 *   { action: "save", config, schedule }          save the draft or the schedule
 *   { action: "test", config, to: string[], example }  send a [TEST] email to the addresses only
 *   { action: "review", audience }                mark the next run reviewed
 */
export async function POST(request: Request): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  let body: Record<string, unknown> & { config?: WeeklyEmailConfig; schedule?: WeeklySaveInput["schedule"]; to?: unknown; example?: unknown; audience?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }

  try {
    if (body.action === "save") {
      const input = { config: body.config, schedule: body.schedule } as WeeklySaveInput;
      if (!isAudience(input.config?.audience)) return NextResponse.json({ error: "Pick a version." }, { status: 400 });
      await saveWeekly(input, profile.id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "test") {
      const config = body.config as WeeklyEmailConfig;
      if (!config || !isAudience(config.audience)) return NextResponse.json({ error: "Pick a version." }, { status: 400 });
      const ctx = await loadWeeklyContext();
      if (!ctx) return NextResponse.json({ error: "The market numbers could not be read, so no test was sent." }, { status: 503 });
      const ex = (await previewExamples(ctx))[config.audience];
      const picked = ex.find((e) => e.key === body.example) ?? ex[0];
      const r = await sendTestEmail(config, Array.isArray(body.to) ? (body.to as unknown[]).map(String) : [], picked.viewer, profile.id);
      return NextResponse.json({ ok: r.failed.length === 0, ...r });
    }
    if (body.action === "review") {
      if (!isAudience(body.audience)) return NextResponse.json({ error: "Pick a version." }, { status: 400 });
      const at = await markNextRunReviewed(body.audience);
      return NextResponse.json({ ok: true, reviewedFor: at });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 400 });
  }
}
