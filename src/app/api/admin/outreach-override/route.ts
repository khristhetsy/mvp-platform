import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  getFounderOverride,
  setFounderOverride,
  resolveFounderOutreachConfig,
  type FounderOverride,
} from "@/lib/outreach/founder-overrides";

export const dynamic = "force-dynamic";

/** Staff gate: only admin/analyst may read or write per-founder overrides. */
async function requireStaff(): Promise<{ userId: string } | { error: Response }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "admin" && profile.role !== "analyst")) {
    return { error: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  }
  return { userId: user.id };
}

/** Load a company's id + founder_id (needed to resolve plan-based caps). */
async function loadCompany(companyId: string): Promise<{ id: string; founder_id: string } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any;
  const { data } = await admin.from("companies").select("id, founder_id").eq("id", companyId).maybeSingle();
  return data ? { id: String(data.id), founder_id: String(data.founder_id) } : null;
}

// GET ?companyId= — the founder's raw override + the resolved effective config.
export async function GET(req: Request): Promise<Response> {
  const gate = await requireStaff();
  if ("error" in gate) return gate.error;

  const companyId = new URL(req.url).searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId required." }, { status: 400 });
  const company = await loadCompany(companyId);
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const [override, effective] = await Promise.all([
    getFounderOverride(companyId),
    resolveFounderOutreachConfig(company),
  ]);
  return NextResponse.json({ override, effective });
}

/** Sanitize the incoming override to the known shape (drop anything unexpected). */
function sanitize(raw: unknown): FounderOverride {
  const o = (raw ?? {}) as Record<string, unknown>;
  const out: FounderOverride = {};

  if (o.match && typeof o.match === "object") {
    const m = o.match as Record<string, unknown>;
    const match: FounderOverride["match"] = {};
    if (m.requiredFields && typeof m.requiredFields === "object") {
      const rf = m.requiredFields as Record<string, unknown>;
      match.requiredFields = {
        industry: true,
        checkSize: rf.checkSize === true,
        revenueStage: rf.revenueStage === true,
        useOfFunds: rf.useOfFunds === true,
        geography: rf.geography === true,
        activeRating: rf.activeRating === true,
      };
    }
    const num = (v: unknown) => (typeof v === "number" && v >= 0 && v <= 100 ? Math.round(v) : undefined);
    if (num(m.minMatch) !== undefined) match.minMatch = num(m.minMatch);
    if (num(m.minInvestorScore) !== undefined) match.minInvestorScore = num(m.minInvestorScore);
    if (typeof m.requireRated === "boolean") match.requireRated = m.requireRated;
    if (m.weights && typeof m.weights === "object") {
      const w = m.weights as Record<string, unknown>;
      const keys = ["sector", "specificity", "stage", "checkSize", "revenue", "activity"] as const;
      const acc = {} as NonNullable<NonNullable<FounderOverride["match"]>["weights"]>;
      for (const k of keys) acc[k] = typeof w[k] === "number" && (w[k] as number) >= 0 && (w[k] as number) <= 100 ? Math.round(w[k] as number) : 0;
      match.weights = acc;
    }
    if (Object.keys(match).length) out.match = match;
  }

  if (o.automation && typeof o.automation === "object") {
    const a = o.automation as Record<string, unknown>;
    const auto: NonNullable<FounderOverride["automation"]> = {};
    if (a.capOverride === null) auto.capOverride = null;
    else if (typeof a.capOverride === "number" && a.capOverride >= 0 && a.capOverride <= 100000) auto.capOverride = Math.round(a.capOverride);
    const iso = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    if (a.startDate !== undefined) auto.startDate = iso(a.startDate);
    if (a.cadence === "weekly" || a.cadence === "daily") auto.cadence = a.cadence;
    if (a.pause && typeof a.pause === "object") {
      const p = a.pause as Record<string, unknown>;
      auto.pause = { enabled: p.enabled === true, until: iso(p.until) };
    }
    if (Object.keys(auto).length) out.automation = auto;
  }

  if (o.message && typeof o.message === "object") {
    const m = o.message as Record<string, unknown>;
    const msg: FounderOverride["message"] = {};
    if (typeof m.subject === "string") msg.subject = m.subject.slice(0, 300);
    if (typeof m.intro === "string") msg.intro = m.intro.slice(0, 4000);
    if (typeof m.closing === "string") msg.closing = m.closing.slice(0, 4000);
    if (Object.keys(msg).length) out.message = msg;
  }

  return out;
}

// PATCH { companyId, override } — save (or clear) the founder's override.
export async function PATCH(req: Request): Promise<Response> {
  const gate = await requireStaff();
  if ("error" in gate) return gate.error;

  const body = (await req.json().catch(() => null)) as { companyId?: string; override?: unknown } | null;
  if (!body?.companyId) return NextResponse.json({ error: "companyId required." }, { status: 400 });
  const company = await loadCompany(body.companyId);
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const override = sanitize(body.override);
  const ok = await setFounderOverride(body.companyId, override, gate.userId);
  const effective = await resolveFounderOutreachConfig(company);
  return NextResponse.json({ ok, override, effective });
}
