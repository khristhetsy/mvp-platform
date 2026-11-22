import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { isFeatureEnabled } from "@/lib/feature-controls";
import { writeAuditLog } from "@/lib/data/audit";
import { gateTermSheetApi } from "@/lib/term-sheet/gate";
import { TERM_SHEET_FORMS } from "@/lib/term-sheet/fields";
import { pullFromRoundStructure } from "@/lib/term-sheet/round-structure";
import { createTermSheet, deleteTermSheet, getRoundStructure, getTermSheet, listTermSheets, updateTermSheet } from "@/lib/term-sheet/store";
import { parseFormType, sanitizeLinked, sanitizeValues } from "@/lib/term-sheet/values";
import type { TermSheetSource } from "@/lib/term-sheet/types";

export const dynamic = "force-dynamic";

function subFlags(flags: Parameters<typeof isFeatureEnabled>[0]) {
  return {
    roundStructure: isFeatureEnabled(flags, "founder", "term_sheet_round_structure"),
    documentsUpload: isFeatureEnabled(flags, "founder", "term_sheet_documents_upload"),
    wordExport: isFeatureEnabled(flags, "founder", "term_sheet_word_export"),
  };
}

/** List the company's term sheets, or load one with ?id=. Includes the saved Round structure and the switches. */
export async function GET(request: Request): Promise<Response> {
  const g = await gateTermSheetApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = new URL(request.url).searchParams.get("id");
    const flags = subFlags(g.flags);
    const roundStructure = flags.roundStructure ? await getRoundStructure(g.supabase, g.company.id) : null;
    const company = { id: g.company.id, name: g.company.company_name };
    if (id) {
      const termSheet = await getTermSheet(g.supabase, g.company.id, id);
      if (!termSheet) return NextResponse.json({ error: "Term sheet not found." }, { status: 404 });
      return NextResponse.json({ termSheet, roundStructure, flags, company });
    }
    const termSheets = await listTermSheets(g.supabase, g.company.id);
    return NextResponse.json({ termSheets, roundStructure, flags, company });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load term sheets." }, { status: 500 });
  }
}

/** Create a term sheet. fromRoundStructure pulls the saved Round structure into the blanks. ackNotice is required. */
export async function POST(request: Request): Promise<Response> {
  const g = await gateTermSheetApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json().catch(() => ({}))) as {
      formType?: unknown;
      fromRoundStructure?: boolean;
      values?: unknown;
      title?: unknown;
      ackNotice?: boolean;
      source?: unknown;
    };
    const formType = parseFormType(body.formType);
    if (!formType) return NextResponse.json({ error: "Choose a term sheet template." }, { status: 400 });
    if (body.ackNotice !== true) {
      return NextResponse.json({ error: "Please confirm the founder notice before you create a term sheet." }, { status: 400 });
    }
    const flags = subFlags(g.flags);
    let values = sanitizeValues(formType, body.values);
    let linked = {};
    let source: TermSheetSource = body.source === "uploaded" ? "uploaded" : "scratch";
    let snapshot = null;
    if (body.fromRoundStructure) {
      if (!flags.roundStructure) return NextResponse.json({ error: "Generating from the Round structure is not available." }, { status: 403 });
      const saved = await getRoundStructure(g.supabase, g.company.id);
      if (!saved) return NextResponse.json({ error: "Save your Round structure first." }, { status: 400 });
      const pulled = pullFromRoundStructure(formType, saved.inputs);
      values = { ...pulled.values, ...values };
      linked = pulled.linked;
      source = "round_structure";
      snapshot = saved.inputs;
    }
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 120) : `${g.company.company_name} ${TERM_SHEET_FORMS[formType].label} term sheet`;
    const termSheet = await createTermSheet(g.supabase, g.company.id, g.profile.id, { formType, source, title, values, linkedFields: linked, roundStructure: snapshot });
    await writeAuditLog(g.supabase, {
      userId: g.profile.id,
      action: "term_sheet_notice_acknowledged",
      entityType: "term_sheet",
      entityId: termSheet.id,
      metadata: { companyId: g.company.id, formType, source },
    });
    return NextResponse.json({ termSheet });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to create the term sheet." }, { status: 500 });
  }
}

/** Save edits: values, linked blanks, title. Never changes the template text. */
export async function PATCH(request: Request): Promise<Response> {
  const g = await gateTermSheetApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json().catch(() => ({}))) as { id?: unknown; values?: unknown; linkedFields?: unknown; title?: unknown };
    if (typeof body.id !== "string") return NextResponse.json({ error: "Term sheet id is required." }, { status: 400 });
    const existing = await getTermSheet(g.supabase, g.company.id, body.id);
    if (!existing) return NextResponse.json({ error: "Term sheet not found." }, { status: 404 });
    const termSheet = await updateTermSheet(g.supabase, g.company.id, body.id, g.profile.id, {
      values: body.values !== undefined ? sanitizeValues(existing.formType, body.values) : undefined,
      linkedFields: body.linkedFields !== undefined ? sanitizeLinked(existing.formType, body.linkedFields) : undefined,
      title: typeof body.title === "string" ? body.title.trim().slice(0, 120) : undefined,
      // Editing a finalized term sheet starts a new draft of it; the finalized files stay in Documents.
      status: existing.status === "finalized" ? "draft" : undefined,
    });
    return NextResponse.json({ termSheet });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to save the term sheet." }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const g = await gateTermSheetApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Term sheet id is required." }, { status: 400 });
    await deleteTermSheet(g.supabase, g.company.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to delete the term sheet." }, { status: 500 });
  }
}
