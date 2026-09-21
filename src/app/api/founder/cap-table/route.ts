import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { gateCapTableApi } from "@/lib/cap-table/gate";
import { getCapTable, upsertCapTable } from "@/lib/cap-table/store";
import { defaultHolders } from "@/lib/cap-table/compute";
import type { Holder, RoundModel } from "@/lib/cap-table/types";
import { emitActivity } from "@/lib/activity/emit";

export const dynamic = "force-dynamic";

function sanitizeHolders(input: unknown): Holder[] {
  if (!Array.isArray(input)) return [];
  const groups = new Set(["founder", "pool", "investor"]);
  return input.slice(0, 100).map((raw, i) => {
    const h = (raw ?? {}) as Record<string, unknown>;
    const group = groups.has(String(h.group)) ? (String(h.group) as Holder["group"]) : "investor";
    const shares = Number(h.shares);
    return {
      id: typeof h.id === "string" && h.id ? h.id : `h-${i}-${Date.now()}`,
      name: String(h.name ?? "Unnamed").slice(0, 120),
      group,
      shareClass: String(h.shareClass ?? "Common").slice(0, 60),
      shares: Number.isFinite(shares) ? Math.max(0, Math.round(shares)) : 0,
    };
  });
}

function sanitizeRound(input: unknown): RoundModel | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  const newInvestment = Number(r.newInvestment);
  const preMoney = Number(r.preMoney);
  if (!Number.isFinite(newInvestment) && !Number.isFinite(preMoney)) return null;
  return {
    newInvestment: Number.isFinite(newInvestment) ? Math.max(0, newInvestment) : 0,
    preMoney: Number.isFinite(preMoney) ? Math.max(0, preMoney) : 0,
  };
}

/** Load the cap table, seeding sensible defaults + reusing the Business Plan raise. */
export async function GET(): Promise<Response> {
  const g = await gateCapTableApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const existing = await getCapTable(g.supabase, g.company.id);
    const holders = existing && existing.holders.length > 0 ? existing.holders : defaultHolders();

    let round = existing?.round ?? null;
    if (!round) {
      const raise = g.company.funding_amount ?? null;
      if (raise && raise > 0) round = { newInvestment: raise, preMoney: raise * 4 };
    }

    return NextResponse.json({
      companyName: g.company.company_name,
      holders,
      round,
      isNew: !existing,
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load the cap table." }, { status: 500 });
  }
}

/** Save holders + modeled round. */
export async function PUT(req: Request): Promise<Response> {
  const g = await gateCapTableApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json().catch(() => ({}))) as { holders?: unknown; round?: unknown };
    const holders = sanitizeHolders(body.holders);
    const saved = await upsertCapTable(g.supabase, g.company.id, g.profile.id, {
      holders,
      round: sanitizeRound(body.round),
    });

    emitActivity({
      classKey: "cap_table_changed",
      actorUserId: g.profile.id,
      actorRole: "founder",
      companyId: g.company.id,
      entityType: "cap_table",
      entityId: g.company.id,
      sourceModule: "cap-table",
      title: `Saved the cap table — ${holders.length} shareholder${holders.length === 1 ? "" : "s"}`,
      metadata: { shareholder_count: holders.length },
      // The cap table is edited in a live grid; without a window every keystroke
      // that autosaves would be its own alert.
      dedupeKey: `activity-cap-table:${g.company.id}`,
      dedupeWindowMinutes: 30,
    });

    return NextResponse.json({ ok: true, updatedAt: saved.updatedAt });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to save the cap table." }, { status: 500 });
  }
}
