/**
 * Backfill Investor Type for investors from (1) the Odoo "Investor Profile" field and
 * (2) SEC Form D source → Venture Capital + Fund Manager. Writes raw.__profile.investorTypes
 * (what the Contacts grid groups on). Preview reports the detected field + resulting
 * distribution so the mapping is verified before any write. Super-admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { isSuperAdmin } from "@/lib/rbac/effective-permissions";
import { decideInvestorTypes, INVESTOR_PROFILE_LABEL_RE, type ContactRow } from "@/lib/sales/backfill-investor-type";

export const dynamic = "force-dynamic";

const SCAN_CAP = 40000;
const PAGE = 1000;

const schema = z.object({
  mode: z.enum(["preview", "apply"]),
  overwrite: z.boolean().optional(),
  label: z.string().max(120).optional(), // force a specific extra field label
});

type Row = ContactRow & { id: string };

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  if (!isSuperAdmin(profile)) return NextResponse.json({ error: "Only a super admin can run the backfill." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { mode, overwrite = false, label } = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = serviceRoleClientUntyped();

  // Scan investors (contact_type OR module = investor).
  const rows: Row[] = [];
  for (let from = 0; from < SCAN_CAP; from += PAGE) {
    const { data, error } = await db
      .from("crm_contacts")
      .select("id, source, overrides, raw")
      .or("contact_type.eq.investor,module.eq.investor")
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    rows.push(...(data as Row[]));
    if (data.length < PAGE) break;
  }

  const dist = new Map<string, number>();
  const labelHits = new Map<string, number>();
  const sample: { id: string; from: string; types: string[] }[] = [];
  let fromOdoo = 0, fromFormD = 0, existing = 0, none = 0, willWrite = 0;
  const toWrite: { id: string; raw: Record<string, unknown> }[] = [];

  for (const r of rows) {
    const d = decideInvestorTypes(r, { overwrite, label });
    if (d.from === "odoo") fromOdoo++;
    else if (d.from === "formd") fromFormD++;
    else if (d.from === "existing") existing++;
    else none++;
    if (d.matchedLabel) labelHits.set(d.matchedLabel, (labelHits.get(d.matchedLabel) ?? 0) + 1);
    if (d.write && d.types.length) {
      willWrite++;
      for (const t of d.types) dist.set(t, (dist.get(t) ?? 0) + 1);
      if (sample.length < 12) sample.push({ id: r.id, from: d.from, types: d.types });
      if (mode === "apply") {
        const raw = (r.raw ?? {}) as Record<string, unknown>;
        const prof = { ...((raw.__profile as Record<string, unknown>) ?? {}) };
        prof.investorTypes = d.types;
        toWrite.push({ id: r.id, raw: { ...raw, __profile: prof } });
      }
    }
  }

  // Which extra labels look like an investor-profile field (discovery aid for preview).
  const detectedLabels = [...labelHits.entries()].map(([l, n]) => ({ label: l, n })).sort((a, b) => b.n - a.n);

  if (mode === "apply") {
    let written = 0;
    for (let i = 0; i < toWrite.length; i += 200) {
      const chunk = toWrite.slice(i, i + 200);
      await Promise.all(chunk.map((w) => db.from("crm_contacts").update({ raw: w.raw }).eq("id", w.id)));
      written += chunk.length;
    }
    return NextResponse.json({ ok: true, applied: written, fromOdoo, fromFormD, existing, none, detectedLabels });
  }

  return NextResponse.json({
    ok: true,
    scanned: rows.length,
    capped: rows.length >= SCAN_CAP,
    willWrite, fromOdoo, fromFormD, existing, none,
    detectedLabels,
    distribution: [...dist.entries()].map(([type, n]) => ({ type, n })).sort((a, b) => b.n - a.n),
    sample,
    probeRegex: INVESTOR_PROFILE_LABEL_RE.source,
  });
}
