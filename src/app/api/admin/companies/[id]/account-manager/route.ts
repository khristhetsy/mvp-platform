import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listAccountManagerIds, setAccountManager } from "@/lib/team/account-manager";
import { listAssignees } from "@/lib/operations/tasks";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** The account manager of a company and the staff who can be chosen. */
export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;
  const { id } = await ctx.params;

  const [managerIds, staff] = await Promise.all([listAccountManagerIds(id), listAssignees()]);
  return NextResponse.json({ managerId: managerIds[0] ?? null, staff });
}

const schema = z.object({ managerId: z.string().uuid().nullable() });

/** Admins set or clear the account manager of one company. */
export async function PUT(req: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireStaffApi(["admin"]);
  if ("error" in auth) return auth.error as NextResponse;
  const { id } = await ctx.params;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Choose a staff member or none." }, { status: 400 });

  const admin = createServiceRoleClient();
  const { data: company } = await admin.from("companies").select("id").eq("id", id).maybeSingle();
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  try {
    await setAccountManager({ companyId: id, managerId: parsed.data.managerId, assignedBy: auth.profile.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save." }, { status: 400 });
  }
}
