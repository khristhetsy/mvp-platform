import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { executeKw, odooConfigured } from "@/lib/crm-connectors/odoo/client";

export const dynamic = "force-dynamic";

// Read-only diagnostic: find which res.partner field separates founders from
// investors ("Membership Type" per the user) and show its value distribution.
// Admin/analyst only. No writes. Delete once classification is wired.

type FieldRow = { name: string; field_description?: string | false; ttype?: string | false; relation?: string | false };
type GroupRow = Record<string, unknown> & { __count?: number };

const KEYWORDS = ["member", "type", "role", "segment", "category", "kind", "classification", "persona", "audience"];
const GROUPABLE = new Set(["selection", "char", "many2one", "boolean", "many2many"]);

function label(v: unknown): string {
  if (Array.isArray(v)) return String(v[1] ?? v[0]); // many2one [id, name]
  if (v === false || v === null || v === undefined) return "(empty)";
  return String(v);
}

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!odooConfigured()) return NextResponse.json({ error: "Odoo not configured" }, { status: 400 });

  try {
    // 1) Candidate fields on res.partner whose name or label hints at a segment.
    const fields = await executeKw<FieldRow[]>(
      "ir.model.fields",
      "search_read",
      [
        [["model", "=", "res.partner"], ["ttype", "in", Array.from(GROUPABLE)]],
        ["name", "field_description", "ttype", "relation"],
      ],
      { limit: 400 },
    );

    const candidates = fields.filter((f) => {
      const hay = `${f.name} ${f.field_description || ""}`.toLowerCase();
      return KEYWORDS.some((k) => hay.includes(k));
    });

    // 2) For each candidate, group res.partner by it and show top values.
    const distributions: Array<{
      field: string;
      label: string;
      type: string;
      relation?: string | null;
      values: Array<{ value: string; count: number }>;
    }> = [];

    for (const f of candidates) {
      try {
        const groups = await executeKw<GroupRow[]>(
          "res.partner",
          "read_group",
          [[["email", "!=", false]], [f.name], [f.name]],
          { limit: 30, lazy: false },
        );
        const values = groups
          .map((g) => ({ value: label(g[f.name]), count: Number(g.__count ?? 0) }))
          .filter((v) => v.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 15);
        if (values.length > 0) {
          distributions.push({
            field: f.name,
            label: String(f.field_description || f.name),
            type: String(f.ttype || ""),
            relation: f.relation || null,
            values,
          });
        }
      } catch {
        // Field not groupable in this DB — skip.
      }
    }

    // Rank: fields that split into a small number of populated buckets first.
    distributions.sort((a, b) => a.values.length - b.values.length);

    return NextResponse.json({
      hint: "Look for the field whose values are the two member types (founder vs investor). Tell Claude the `field` name and which values map to founder vs investor.",
      candidateCount: candidates.length,
      distributions,
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Inspection failed" },
      { status: 500 },
    );
  }
}
