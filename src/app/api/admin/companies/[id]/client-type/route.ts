import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { profileIsSuperAdmin } from "@/lib/api/super-admin";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { CLIENT_TYPES, normalizeClientType } from "@/lib/listing/client-type";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** The client type of a company, whether the caller may change it, and the change log. */
export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;
  const { id } = await ctx.params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any;
  const [{ data: company }, { data: log }] = await Promise.all([
    admin.from("companies").select("client_type").eq("id", id).maybeSingle(),
    admin
      .from("company_client_type_log")
      .select("id, from_type, to_type, changed_by, changed_at")
      .eq("company_id", id)
      .order("changed_at", { ascending: false })
      .limit(50),
  ]);
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  return NextResponse.json({
    clientType: normalizeClientType(company.client_type),
    canEdit: profileIsSuperAdmin(auth.profile),
    log: log ?? [],
  });
}

const schema = z.object({ clientType: z.enum(CLIENT_TYPES) });

/** Super admins only. Sets the client type and writes one log row per change. */
export async function PUT(req: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireStaffApi(["admin"]);
  if ("error" in auth) return auth.error as NextResponse;
  if (!profileIsSuperAdmin(auth.profile)) {
    return NextResponse.json({ error: "Only super admins can change the client type." }, { status: 403 });
  }
  const { id } = await ctx.params;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Choose Standard or SPV client." }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any;
  const { data: company } = await admin.from("companies").select("client_type").eq("id", id).maybeSingle();
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const from = normalizeClientType(company.client_type);
  const to = parsed.data.clientType;
  if (from === to) return NextResponse.json({ ok: true, clientType: to });

  const { error } = await admin.from("companies").update({ client_type: to }).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 400 });

  await admin
    .from("company_client_type_log")
    .insert({ company_id: id, from_type: from, to_type: to, changed_by: auth.profile.id });

  return NextResponse.json({ ok: true, clientType: to });
}
