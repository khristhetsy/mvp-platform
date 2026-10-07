import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";
import { brandedDefaults, createBrandedTemplate } from "@/lib/email/branded-templates";
import { founderPrefill } from "@/lib/email/branded-prefill";

// GET — the branded designs (masters) and starting values for the signed-in user.
// ?projectId= adds the prefill from that Investor Relations project's founder.
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const profile = await requireRole(["admin"]);
    const projectId = req.nextUrl.searchParams.get("projectId");
    const prefill = projectId ? await founderPrefill(projectId).catch(() => null) : null;
    const { data, error } = await marketingDb()
      .from("email_template_masters")
      .select("id, name, description, compiled_html, placeholder_schema")
      .order("name", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ masters: data ?? [], defaults: await brandedDefaults(profile.id), prefill });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// POST — save a new branded template into the Templates library.
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const profile = await requireRole(["admin"]);
    const body = (await req.json().catch(() => null)) as {
      masterId?: string; slotValues?: Record<string, string>; department?: string | null; name?: string;
    } | null;
    if (!body?.masterId) return NextResponse.json({ error: "Pick a design." }, { status: 400 });
    const template = await createBrandedTemplate(
      { masterId: body.masterId, slotValues: body.slotValues ?? {}, department: body.department ?? null, name: body.name },
      profile.id,
    );
    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
