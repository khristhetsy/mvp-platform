import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { loadSupportLog } from "@/lib/support/log-data";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV of one request's activity log (or the assistant answers), as shown on Support log. */
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const key = req.nextUrl.searchParams.get("request");
  const data = await loadSupportLog(key);
  if (!data.selected) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const header = ["time", "actor", "event", "summary", "detail", "person", "ai_model", "ai_tokens", "ai_cost_usd"];
  const lines = data.selected.events.map((e) => {
    const ai = (e.meta as { ai?: { model?: string; inputTokens?: number; outputTokens?: number; costUsd?: number } } | null)?.ai;
    const person = (e.actor_user_id && data.selected!.names[e.actor_user_id]) || (e.founder_id && data.selected!.names[e.founder_id]) || "";
    return [
      e.created_at,
      e.actor,
      e.kind,
      e.summary,
      e.detail ?? "",
      person,
      ai?.model ?? "",
      ai ? (ai.inputTokens ?? 0) + (ai.outputTokens ?? 0) : "",
      ai?.costUsd != null ? ai.costUsd.toFixed(6) : "",
    ]
      .map(cell)
      .join(",");
  });
  const csv = [header.join(","), ...lines].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="support-log-${(key ?? "latest").slice(0, 12)}.csv"`,
    },
  });
}
