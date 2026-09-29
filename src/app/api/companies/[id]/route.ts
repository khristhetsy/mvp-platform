import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/data/audit";
import type { Database } from "@/lib/supabase/types";
import { companyUpdateSchema } from "@/lib/validation";
import { emitActivity } from "@/lib/activity/emit";
import { diffSnapshots, summarizeDiff } from "@/lib/activity/diff";

/** Fields whose change is a change of TERMS, not of wording. */
const TERMS_FIELDS = new Set([
  "funding_amount",
  "valuation",
  "pre_money_valuation",
  "funding_stage",
  "revenue_stage",
  "annual_revenue_size",
  "arr",
  "mrr",
]);

async function requireCompanyManager(supabase: SupabaseClient<Database>, userId: string, companyId: string) {
  const { data: membership, error } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false as const, status: 400 as const, error: error.message };
  }

  if (membership?.role === "owner" || membership?.role === "admin") {
    return { ok: true as const };
  }

  // Legacy fallback: founder_id owns the company.
  const { data: legacy } = await supabase.from("companies").select("id").eq("id", companyId).eq("founder_id", userId).maybeSingle();
  if (legacy) return { ok: true as const };

  return { ok: false as const, status: 403 as const, error: "You do not have permission to edit this company." };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = companyUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid company settings.", details: parsed.error.flatten() }, { status: 400 });
  }

  const permission = await requireCompanyManager(auth.supabase, auth.profile.id, id);
  if (!permission.ok) {
    return NextResponse.json({ error: permission.error }, { status: permission.status });
  }

  // Read the row before the write so the activity event can say WHAT changed.
  // "$750,000 → $400,000" is worth a notification; "profile updated" is not —
  // you would have to open the company to learn anything from it.
  const fields = Object.keys(parsed.data);
  const { data: before } = await auth.supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  // Cast to the row-update type: some investor-fit columns (migration 20260803002)
  // aren't in the generated Company type yet, but exist in the database.
  const updatePayload = parsed.data as Database["public"]["Tables"]["companies"]["Update"];
  const { data, error } = await auth.supabase.from("companies").update(updatePayload).eq("id", id).select("*").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "company.updated",
    entityType: "company",
    entityId: id,
    metadata: { fields },
  });

  const diff = diffSnapshots(
    before as Record<string, unknown> | null,
    data as Record<string, unknown> | null,
    fields,
  );

  if (diff.changed) {
    // A money or terms change is a different thing from a wording change: it
    // moves the CRR Capital factor and every investor match, so it carries its
    // own class and its own channels.
    const movedTerms = diff.fields.some((f) => TERMS_FIELDS.has(f));
    emitActivity({
      classKey: movedTerms ? "capital_ask_changed" : "profile_edited",
      actorUserId: auth.profile.id,
      actorRole: "founder",
      companyId: id,
      entityType: "company",
      entityId: id,
      sourceModule: "company-settings",
      diff,
      title: movedTerms
        ? `Changed ${summarizeDiff(diff, 2)}`
        : `Edited ${diff.fields.map((f) => f.replace(/_/g, " ")).slice(0, 3).join(", ")}`,
    });
  }

  return NextResponse.json({ company: data });
}

