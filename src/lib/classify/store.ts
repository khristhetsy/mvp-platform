// Prospect Pipeline — Step 2: classify worker + review-queue store.
// Operates on crm_contacts (source of record). Resolved rows get side written;
// ambiguous rows keep side null but record a `signals.classify` note so they
// surface in the manual review queue. Manual overrides are logged.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { classifyContact, type Side } from "./classify";

type Row = {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  company_domain: string | null;
  side_confidence: number | null;
  signals: Record<string, unknown> | null;
};

export interface ClassifyBatchResult {
  processed: number;
  resolved: number;
  ambiguous: number;
  unclassifiedRemaining: number;
}

/** Classify up to `limit` rows that currently have no side. */
export async function classifyBatch(limit = 100): Promise<ClassifyBatchResult> {
  const db = serviceRoleClientUntyped();
  const { data } = await db
    .from("crm_contacts")
    .select("id, name, email, company, company_domain, signals")
    .is("side", null)
    .limit(limit);

  const rows = (data ?? []) as Row[];
  let resolved = 0;
  let ambiguous = 0;

  for (const r of rows) {
    const res = await classifyContact({
      name: r.name,
      email: r.email,
      company: r.company,
      company_domain: r.company_domain,
      signals: r.signals,
    });
    const baseSignals = (r.signals && typeof r.signals === "object" ? r.signals : {}) as Record<string, unknown>;

    if (res.side) {
      await db
        .from("crm_contacts")
        .update({
          side: res.side,
          side_confidence: res.confidence,
          module: res.side,
          signals: { ...baseSignals, classify: { attempted: true, method: res.method, reason: res.reason, confidence: res.confidence } },
        })
        .eq("id", r.id);
      resolved++;
    } else {
      await db
        .from("crm_contacts")
        .update({
          side_confidence: res.confidence,
          signals: { ...baseSignals, classify: { attempted: true, method: res.method, reason: res.reason, confidence: res.confidence, ambiguous: true } },
        })
        .eq("id", r.id);
      ambiguous++;
    }
  }

  const { count } = await db
    .from("crm_contacts")
    .select("id", { count: "exact", head: true })
    .is("side", null);

  return { processed: rows.length, resolved, ambiguous, unclassifiedRemaining: count ?? 0 };
}

export interface ClassifyStats {
  total: number;
  classified: number;
  unclassified: number;
  reviewQueue: number;
}

export async function getClassifyStats(): Promise<ClassifyStats> {
  const db = serviceRoleClientUntyped();
  const [{ count: total }, { count: classified }, { count: unclassified }, { count: reviewQueue }] = await Promise.all([
    db.from("crm_contacts").select("id", { count: "exact", head: true }),
    db.from("crm_contacts").select("id", { count: "exact", head: true }).not("side", "is", null),
    db.from("crm_contacts").select("id", { count: "exact", head: true }).is("side", null),
    db.from("crm_contacts").select("id", { count: "exact", head: true }).is("side", null).filter("signals->classify->>ambiguous", "eq", "true"),
  ]);
  return { total: total ?? 0, classified: classified ?? 0, unclassified: unclassified ?? 0, reviewQueue: reviewQueue ?? 0 };
}

export interface ReviewRow {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  company_domain: string | null;
  side_confidence: number | null;
  reason: string | null;
}

/** Ambiguous rows awaiting a human founder/investor decision. */
export async function getReviewQueue(limit = 50): Promise<ReviewRow[]> {
  const db = serviceRoleClientUntyped();
  const { data } = await db
    .from("crm_contacts")
    .select("id, name, email, company, company_domain, side_confidence, signals")
    .is("side", null)
    .filter("signals->classify->>ambiguous", "eq", "true")
    .order("side_confidence", { ascending: false, nullsFirst: false })
    .limit(limit);
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    company: r.company,
    company_domain: r.company_domain,
    side_confidence: r.side_confidence,
    reason: (((r.signals ?? {}) as Record<string, unknown>)?.classify as { reason?: string } | undefined)?.reason ?? null,
  }));
}

/** Manual founder/investor assignment. Logged; confidence pinned to 100. */
export async function applyOverride(contactId: string, side: Side, adminId: string): Promise<void> {
  const db = serviceRoleClientUntyped();
  const { data: current } = await db.from("crm_contacts").select("signals").eq("id", contactId).single();
  const baseSignals = ((current?.signals && typeof current.signals === "object") ? current.signals : {}) as Record<string, unknown>;
  await db
    .from("crm_contacts")
    .update({
      side,
      side_confidence: 100,
      module: side,
      signals: { ...baseSignals, classify: { ...(baseSignals.classify as object ?? {}), override: true, override_by: adminId, ambiguous: false } },
    })
    .eq("id", contactId);

  try {
    await writeAuditLog(createServiceRoleClient(), {
      userId: adminId,
      action: "contact.classify_override",
      entityType: "crm_contact",
      entityId: contactId,
      metadata: { side },
    });
  } catch {
    /* audit best-effort */
  }
}
