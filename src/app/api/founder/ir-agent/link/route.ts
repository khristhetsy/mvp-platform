import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFounderAgentApi } from "@/lib/ir-agent/founder";
import { buildPublicConfig, linkAgentToOrg } from "@/lib/ir-agent/store";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({ orgId: z.string().uuid() });

/** Admin only: link a company to an AI Agent that was started without one. */
export async function PUT(req: Request) {
  const auth = await requireFounderAgentApi(req);
  if ("error" in auth) return auth.error;
  if (!auth.ctx.actingAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid company." }, { status: 400 });

  const db = serviceRoleClientUntyped();
  const [{ data: org }, { data: company }] = await Promise.all([
    db.from("organizations").select("id, name").eq("id", parsed.data.orgId).maybeSingle(),
    db.from("companies").select("company_name").eq("org_id", parsed.data.orgId).limit(1).maybeSingle(),
  ]);
  if (!org) return NextResponse.json({ error: "Company not found." }, { status: 404 });
  const name = String((company as { company_name?: string } | null)?.company_name ?? (org as { name?: string }).name ?? "").trim();
  const result = await linkAgentToOrg(auth.ctx.agent, parsed.data.orgId, name);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ agent: result.agent, config: await buildPublicConfig(result.agent) });
}
