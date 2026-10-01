import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { writeAuditLog } from "@/lib/data/audit";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { AI_BUDGET_CATEGORIES, featureLabel, type AiBudgetCategory } from "@/lib/ai-budget/config";
import { getAiBudgetStatus } from "@/lib/ai-budget/service";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = (): any => createServiceRoleClient();

/**
 * GET: budget vs actual per category for the current month, the per-tool
 * breakdown, and the alert email. GET ?export=csv returns one row per call.
 */
export async function GET(req: NextRequest) {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (req.nextUrl.searchParams.get("export") === "csv") return exportCsv();

  try {
    const [status, breakdown, settings] = await Promise.all([
      getAiBudgetStatus(),
      raw().rpc("ai_spend_breakdown"),
      raw().from("ai_budget_settings").select("alert_email").eq("id", 1).maybeSingle(),
    ]);
    const tools = ((breakdown.data ?? []) as Array<{ category: string; feature: string; calls: number | string; cost_usd: number | string }>)
      .map((t) => ({ category: t.category, feature: t.feature, label: featureLabel(t.feature), calls: Number(t.calls), costUsd: Number(t.cost_usd) }))
      .sort((a, b) => b.costUsd - a.costUsd);
    const categories = AI_BUDGET_CATEGORIES.map((c) => {
      const row = status.find((r) => r.category === c);
      return {
        category: c,
        budgetUsd: row ? Number(row.monthly_usd) : 0,
        spentUsd: row ? Number(row.spent_usd) : 0,
        calls: row ? Number(row.calls) : 0,
        tools: tools.filter((t) => t.category === c),
      };
    });
    return NextResponse.json({ categories, alertEmail: settings.data?.alert_email ?? null });
  } catch (e) {
    // Most likely the migration has not been applied yet.
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load the AI budget." }, { status: 503 });
  }
}

const putSchema = z.object({
  budgets: z.record(z.enum(AI_BUDGET_CATEGORIES), z.number().min(0).max(100_000)),
});

/** PUT: save monthly budgets (USD) for one or more categories. */
export async function PUT(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Enter a dollar amount of 0 or more for each budget." }, { status: 400 });

  const now = new Date().toISOString();
  const rows = (Object.entries(parsed.data.budgets) as Array<[AiBudgetCategory, number]>).map(([category, usd]) => ({
    category,
    monthly_usd: Math.round(usd * 100) / 100,
    updated_at: now,
    updated_by: auth.userId,
  }));
  const { error } = await raw().from("ai_budgets").upsert(rows, { onConflict: "category" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(auth.userSupabase, {
    userId: auth.userId,
    action: "admin.ai_budget_updated",
    entityType: "ai_budgets",
    entityId: "monthly",
    metadata: { budgets: parsed.data.budgets },
  });
  return NextResponse.json({ success: true });
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function exportCsv(): Promise<Response> {
  const d = new Date();
  const since = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
  const header = ["created_at", "vendor", "category", "tool", "model", "input_tokens", "output_tokens", "units", "cost_usd"];
  const lines = [header.join(",")];
  // Page through the month (PostgREST caps a response at 1,000 rows).
  for (let from = 0; ; from += 1000) {
    const { data, error } = await raw()
      .from("ai_spend_events")
      .select("created_at, vendor, category, feature, model, input_tokens, output_tokens, units, cost_usd")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const r of data ?? []) {
      lines.push([r.created_at, r.vendor, r.category, featureLabel(r.feature), r.model, r.input_tokens, r.output_tokens, r.units, r.cost_usd].map(csvCell).join(","));
    }
    if (!data || data.length < 1000) break;
  }
  const { data: calls } = await raw()
    .from("call_attempts")
    .select("created_at, cost")
    .not("cost", "is", null)
    .gte("created_at", since)
    .limit(5000);
  for (const c of calls ?? []) {
    lines.push([c.created_at, "vapi", "voice", featureLabel("vapi_calls"), "", "", "", 1, c.cost].map(csvCell).join(","));
  }
  const month = since.slice(0, 7);
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ai-spend-${month}.csv"` },
  });
}
