import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorMessage } from "@/lib/api/errors";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import type { Company } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const schema = z.object({ isSample: z.boolean() });

/** Mark/unmark a company as a sample (hidden from all public surfaces). */
export async function POST(
  request: Request,
  { params }: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const { id } = await params;
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const updatePatch: Partial<Company> = { is_sample: parsed.data.isSample };
  // Marking as sample also pulls it from the marketplace, defensively.
  if (parsed.data.isSample) {
    updatePatch.is_published = false;
    updatePatch.marketplace_visible = false;
  }

  const { data, error } = await auth.supabase
    .from("companies")
    .update(updatePatch)
    .eq("id", id)
    .select("id, is_sample, is_published, marketplace_visible")
    .single();

  if (error) {
    return NextResponse.json({ error: apiErrorMessage(error) }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: parsed.data.isSample ? "company_marked_sample" : "company_unmarked_sample",
    entityType: "company",
    entityId: id,
    metadata: { isSample: parsed.data.isSample },
  });

  return NextResponse.json({ company: data });
}
