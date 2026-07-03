import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { getEditableSchema, readPartnerValues } from "@/lib/crm-connectors/odoo/schema";

export const dynamic = "force-dynamic";

// Full editable-field schema + current values for a contact. Admin-only.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Only admins can edit source records." }, { status: 403 });
  const { id } = await params;
  const externalId = decodeURIComponent(id).replace(/^mirror:/, "");

  try {
    const schema = await getEditableSchema();
    const values = await readPartnerValues(externalId, schema);
    return NextResponse.json({ schema, values });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load fields." }, { status: 500 });
  }
}
