/**
 * Odoo crm.lead → Sales Hub opportunity import (build-spec: Sales Hub Odoo import).
 *
 * Source is the Odoo "Lead/Opportunity (crm.lead)" .xlsx export (columns: Opportunity,
 * Contact Name, Email, Salesperson, Closing Probability, Expected Revenue, Expected
 * MRR, Stage). The export carries no Odoo lead id, so dedup keys on the lowercased
 * email.
 *
 * Rules (confirmed with khris):
 *  - Scope: every row (all salespeople).
 *  - Value: left blank — the Odoo amount is only stored as a reference note so the
 *    forecast/MRR stay honest (iCapOS fees are $499–$1,000/mo, not the Odoo figure).
 *  - Stages: mapped to the default pipeline; ICAPOS + Won → won, Loss → lost.
 *  - No duplicates: skip any lead whose email already has an opportunity in iCapOS,
 *    collapse repeated emails within the file, skip rows with no email.
 *  - Contact linked to an existing CRM contact by email where possible.
 */

import ExcelJS from "exceljs";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getDefaultPipeline, type Stage } from "@/lib/sales/opportunities";
import { listAssignableStaff } from "@/lib/sales/settings";
import { logActivity } from "@/lib/sales/activity";
import { executeKw, odooConfigured } from "@/lib/crm-connectors/odoo/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export const ODOO_OPP_SOURCE = "odoo";

export type OdooLeadRow = {
  /** Odoo crm.lead id when pulled live; null for the file export (dedup falls back to email). */
  externalId: string | null;
  title: string;
  contactName: string | null;
  email: string | null;
  salesperson: string | null;
  probability: number | null;
  expectedRevenue: number | null;
  expectedMrr: number | null;
  stage: string | null;
};

/** Odoo stage → { iCapOS status, target stage keyword }. Open stages resolve to a
 *  default-pipeline stage by keyword; won/lost set status and pick an is_won/first stage. */
type StageTarget = { status: "open" | "won" | "lost"; keyword: string | null };
function stageTarget(odooStage: string | null): StageTarget {
  const s = (odooStage ?? "").trim().toLowerCase();
  if (!s) return { status: "open", keyword: "new" };
  if (s === "won" || s === "icapos") return { status: "won", keyword: null };
  if (s === "loss" || s === "lost") return { status: "lost", keyword: null };
  if (s.includes("proposal")) return { status: "open", keyword: "proposal" };
  if (s.includes("meeting")) return { status: "open", keyword: "qualif" };
  if (s.includes("follow") || s === "pending") return { status: "open", keyword: "pending" };
  if (s.includes("new")) return { status: "open", keyword: "new" };
  return { status: "open", keyword: "new" };
}

function parseProbability(v: unknown): number | null {
  if (v == null) return null;
  const n = parseFloat(String(v).replace("%", "").trim());
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
}
function parseAmount(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function normEmail(v: unknown): string | null {
  const e = String(v ?? "").trim().toLowerCase();
  return e && e.includes("@") ? e : null;
}

/** Parse the Odoo crm.lead .xlsx export. Column order is matched by header name so a
 *  re-ordered export still works. */
export async function parseOdooLeadExport(buffer: ArrayBuffer | Buffer): Promise<OdooLeadRow[]> {
  const wb = new ExcelJS.Workbook();
  // exceljs accepts a Node Buffer; normalize ArrayBuffer to one. Cast to exceljs's own
  // expected param type — @types/node's Buffer is generic (Buffer<ArrayBufferLike>)
  // and doesn't structurally match exceljs's non-generic Buffer typing.
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(new Uint8Array(buffer as ArrayBuffer));
  await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const headerRow = ws.getRow(1);
  const idx: Record<string, number> = {};
  headerRow.eachCell((cell, col) => { idx[String(cell.value ?? "").trim().toLowerCase()] = col; });
  const col = (name: string) => idx[name.toLowerCase()] ?? 0;
  const cO = col("Opportunity"), cN = col("Contact Name"), cE = col("Email"), cS = col("Salesperson"),
    cP = col("Closing Probability"), cR = col("Expected Revenue"), cM = col("Expected MRR"), cG = col("Stage");

  const cellText = (row: ExcelJS.Row, c: number): string | null => {
    if (!c) return null;
    const v = row.getCell(c).value;
    if (v == null) return null;
    if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text).trim() || null;
    return String(v).trim() || null;
  };

  const rows: OdooLeadRow[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const title = cellText(row, cO);
    const contactName = cellText(row, cN);
    if (!title && !contactName) return; // blank row
    rows.push({
      externalId: null,
      title: title ?? contactName ?? "Untitled opportunity",
      contactName,
      email: normEmail(cellText(row, cE)),
      salesperson: cellText(row, cS),
      probability: parseProbability(cellText(row, cP)),
      expectedRevenue: parseAmount(cellText(row, cR)),
      expectedMrr: parseAmount(cellText(row, cM)),
      stage: cellText(row, cG),
    });
  });
  return rows;
}

// ── Live pull from Odoo (reuses the existing crm-connectors/odoo client) ─────────
type LeadRow = {
  id: number;
  name?: string | false;
  contact_name?: string | false;
  partner_name?: string | false;
  partner_id?: [number, string] | false;
  email_from?: string | false;
  user_id?: [number, string] | false;
  probability?: number | false;
  expected_revenue?: number | false;
  recurring_revenue?: number | false;
  stage_id?: [number, string] | false;
};

const LEAD_FIELDS_BASE = ["id", "name", "contact_name", "partner_name", "partner_id", "email_from", "user_id", "probability", "expected_revenue", "stage_id"];

function mapLeadRow(r: LeadRow): OdooLeadRow {
  const contact = (typeof r.contact_name === "string" && r.contact_name)
    || (typeof r.partner_name === "string" && r.partner_name)
    || (Array.isArray(r.partner_id) ? r.partner_id[1] : null) || null;
  return {
    externalId: String(r.id),
    title: (typeof r.name === "string" && r.name) || contact || "Untitled opportunity",
    contactName: contact,
    email: normEmail(r.email_from),
    salesperson: Array.isArray(r.user_id) ? r.user_id[1] : null,
    probability: typeof r.probability === "number" ? Math.round(r.probability) : null,
    expectedRevenue: typeof r.expected_revenue === "number" ? r.expected_revenue : null,
    expectedMrr: typeof r.recurring_revenue === "number" ? r.recurring_revenue : null,
    stage: Array.isArray(r.stage_id) ? r.stage_id[1] : null,
  };
}

export function isOdooLiveConfigured(): boolean {
  return odooConfigured();
}

/**
 * Pull every opportunity (crm.lead type=opportunity) across all salespeople, including
 * lost ones (active=false) via active_test:false. recurring_revenue (MRR) only exists
 * when CRM recurring plans are enabled, so we try with it and retry without on error.
 */
export async function fetchOdooOpportunities(): Promise<OdooLeadRow[]> {
  if (!odooConfigured()) throw new Error("Odoo API isn't configured (ODOO_URL/DB/USERNAME/API_KEY).");
  const domain: unknown[] = [["type", "=", "opportunity"]];
  const kwargs = { limit: 20000, order: "id asc", context: { active_test: false } };

  let rows: LeadRow[];
  try {
    rows = await executeKw<LeadRow[]>("crm.lead", "search_read", [domain, [...LEAD_FIELDS_BASE, "recurring_revenue"]], kwargs);
  } catch {
    // recurring_revenue not available on this Odoo — pull without it.
    rows = await executeKw<LeadRow[]>("crm.lead", "search_read", [domain, LEAD_FIELDS_BASE], kwargs);
  }
  return rows.map(mapLeadRow);
}

export type OppDraft = {
  externalId: string; // Odoo lead id (live) or email (file) — the dedup key
  title: string; contactName: string | null; email: string;
  status: "open" | "won" | "lost"; stageId: string | null;
  probability: number | null; ownerId: string | null; contactCrmId: string | null;
  notes: string;
};

export type ImportPlan = {
  creates: OppDraft[];
  skippedNoEmail: number;
  skippedDupInFile: number;
  skippedExisting: number;
  byStatus: { open: number; won: number; lost: number };
};

function money(n: number | null): string {
  return n == null ? "—" : `$${n.toLocaleString()}`;
}

/** Resolve a keyword to a stage id in the default pipeline. */
function resolveStageId(stages: Stage[], target: StageTarget): string | null {
  if (stages.length === 0) return null;
  if (target.status === "won") return (stages.find((s) => s.is_won) ?? stages[stages.length - 1])?.id ?? null;
  if (target.status === "lost") return null; // lost opps carry status, not a stage
  if (target.keyword) {
    const hit = stages.find((s) => !s.is_won && s.name.toLowerCase().includes(target.keyword as string));
    if (hit) return hit.id;
  }
  return (stages.find((s) => !s.is_won) ?? stages[0])?.id ?? null;
}

/**
 * Build the import plan: dedup, map, resolve stage/owner/contact — but write nothing.
 * `existingEmails` is the set of emails that already have an opportunity in iCapOS.
 */
export async function planImport(rows: OdooLeadRow[]): Promise<ImportPlan> {
  const pipeline = await getDefaultPipeline();
  const stages = pipeline?.stages ?? [];
  const staff = await listAssignableStaff();
  const staffByName = new Map(staff.map((s) => [s.name.trim().toLowerCase(), s.id]));

  // Existing opportunities' emails — the "already in iCapOS" skip set.
  const { data: existing } = await db().from("sales_opportunities").select("contact_email, external_source, external_id");
  const existingEmails = new Set<string>();
  for (const r of (existing ?? []) as Array<{ contact_email: string | null; external_source: string | null; external_id: string | null }>) {
    if (r.contact_email) existingEmails.add(r.contact_email.trim().toLowerCase());
    if (r.external_source === ODOO_OPP_SOURCE && r.external_id) existingEmails.add(r.external_id.trim().toLowerCase());
  }

  // Contact lookup by email (only for emails we might import).
  const wantedEmails = [...new Set(rows.map((r) => r.email).filter((e): e is string => !!e))];
  const contactByEmail = new Map<string, string>();
  for (let i = 0; i < wantedEmails.length; i += 200) {
    const batch = wantedEmails.slice(i, i + 200);
    const { data } = await db().from("crm_contacts").select("id, email").in("email", batch);
    for (const c of (data ?? []) as Array<{ id: string; email: string | null }>) {
      if (c.email) contactByEmail.set(c.email.trim().toLowerCase(), c.id);
    }
  }

  const plan: ImportPlan = { creates: [], skippedNoEmail: 0, skippedDupInFile: 0, skippedExisting: 0, byStatus: { open: 0, won: 0, lost: 0 } };
  const seenInFile = new Set<string>();

  for (const r of rows) {
    if (!r.email) { plan.skippedNoEmail++; continue; }
    if (seenInFile.has(r.email)) { plan.skippedDupInFile++; continue; }
    seenInFile.add(r.email);
    if (existingEmails.has(r.email)) { plan.skippedExisting++; continue; }

    const target = stageTarget(r.stage);
    const noteAmount = `Odoo estimate: ${money(r.expectedRevenue)} expected revenue / ${money(r.expectedMrr)} MRR`;
    const noteStage = r.stage ? ` · Odoo stage: ${r.stage}` : "";
    plan.creates.push({
      externalId: r.externalId ?? r.email,
      title: r.title,
      contactName: r.contactName,
      email: r.email,
      status: target.status,
      stageId: resolveStageId(stages, target),
      probability: r.probability,
      ownerId: r.salesperson ? staffByName.get(r.salesperson.trim().toLowerCase()) ?? null : null,
      contactCrmId: contactByEmail.get(r.email) ?? null,
      notes: `${noteAmount}${noteStage}`,
    });
    plan.byStatus[target.status]++;
  }
  return plan;
}

/** Insert the planned opportunities. Value stays blank; Odoo amount lives in notes. */
export async function commitImport(creates: OppDraft[], actorId: string | null): Promise<{ created: number }> {
  if (creates.length === 0) return { created: 0 };
  const pipeline = await getDefaultPipeline();
  const now = new Date().toISOString();
  const rows = creates.map((c) => ({
    title: c.title,
    contact_name: c.contactName,
    contact_email: c.email,
    contact_crm_id: c.contactCrmId,
    pipeline_id: pipeline?.id ?? null,
    stage_id: c.stageId,
    status: c.status,
    value_cents: null,
    billing: "yearly",
    probability: c.probability,
    source: "Odoo",
    owner_id: c.ownerId,
    created_by: actorId,
    notes: c.notes,
    external_source: ODOO_OPP_SOURCE,
    external_id: c.externalId,
    created_at: now,
    updated_at: now,
  }));

  let created = 0;
  // Insert in chunks; ignore conflicts on the external unique index (idempotent re-run).
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { data, error } = await db()
      .from("sales_opportunities")
      .upsert(batch, { onConflict: "external_source,external_id", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    created += (data ?? []).length;
  }
  await logActivity({ kind: "converted", summary: `Imported ${created} opportunities from Odoo`, actorId });
  return { created };
}
