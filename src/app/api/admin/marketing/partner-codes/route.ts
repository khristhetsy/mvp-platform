import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listPartnerCodes, validateNewPartnerCode } from "@/lib/listing/deal-notice-admin";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any -- partner_codes is not in the generated types yet */

/** GET: every partner code with its claims and completed listings. Staff only. */
export async function GET() {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json({ codes: await listPartnerCodes() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/** POST { partnerName, code }: creates an active code (uppercase, unique). */
export async function POST(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { partnerName?: unknown; code?: unknown } | null;
  const v = validateNewPartnerCode(body ?? {});
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const db = createServiceRoleClient() as any;
  const { data: existing } = await db.from("partner_codes").select("id").eq("code", v.code).maybeSingle();
  if (existing) return NextResponse.json({ error: `The code ${v.code} is already used.` }, { status: 409 });

  const { error } = await db
    .from("partner_codes")
    .insert({ code: v.code, partner_name: v.partnerName, is_active: true, created_by: auth.profile.id });
  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json({ error: duplicate ? `The code ${v.code} is already used.` : error.message }, { status: duplicate ? 409 : 500 });
  }
  return NextResponse.json({ codes: await listPartnerCodes(db) });
}

/** PATCH { id, isActive }: turns a code on or off. Existing attribution is kept. */
export async function PATCH(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { id?: unknown; isActive?: unknown } | null;
  if (typeof body?.id !== "string" || typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "id and isActive are required." }, { status: 400 });
  }
  const db = createServiceRoleClient() as any;
  const { error } = await db.from("partner_codes").update({ is_active: body.isActive }).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
